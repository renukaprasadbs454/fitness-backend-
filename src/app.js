const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const env = require("./config/env");
const logger = require("./config/logger");
const swaggerSpec = require("./docs/swagger");
const v1Routes = require("./routes/v1");
const { generalLimiter } = require("./middlewares/rateLimiter.middleware");
const { signS3Urls } = require("./middlewares/signedUrl.middleware");
const { errorHandler, notFoundHandler } = require("./middlewares/error.middleware");
const { isOriginAllowed } = require("./utils/corsPolicy");

const app = express();

function storageImageOrigins() {
  if (env.storage.driver !== "s3") return [];

  const { bucket, endpoint, region, publicUrlTemplate } = env.storage.aws;
  const origins = new Set();
  const addOrigin = (candidate) => {
    if (!candidate) return;
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // Ignore malformed optional storage URLs; they cannot be valid image origins.
    }
  };

  addOrigin(endpoint);
  if (publicUrlTemplate) {
    addOrigin(publicUrlTemplate.replaceAll("{bucket}", bucket || "bucket").replaceAll("{key}", "csp-image"));
  }
  if (bucket && !endpoint) addOrigin(`https://${bucket}.s3.${region}.amazonaws.com`);
  return [...origins];
}

// Render (and most PaaS hosts) terminate TLS at a reverse proxy in front of
// this app. Without this, Express's req.ip resolves to that proxy's address
// for every request regardless of who actually sent it — so express-rate-limit
// below ends up rate-limiting all users combined as if they were one client,
// instead of per real client IP (read from X-Forwarded-For).
app.set("trust proxy", 1);

// ── Security & parsing ──────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", ...storageImageOrigins()],
        frameSrc: ["'self'", "http://localhost:5555"],
        connectSrc: ["'self'", "http://localhost:5050", "https://localhost:5050", "http://localhost:4000", "https://localhost:4000", "http://localhost:*", "http://127.0.0.1:*"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"]
      }
    },
    // Helmet's default same-origin resource policy blocks the web client
    // (served from a different origin, e.g. localhost:8081) from loading
    // uploaded images/avatars from this API — allow cross-origin reads of
    // our own static assets (uploads, admin) while keeping every other
    // helmet protection at its default.
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // CORS only applies to browser requests, which always send an Origin
      // header. Requests with no Origin (native mobile fetch, curl, health
      // checks, server-to-server calls) aren't a CORS scenario at all and
      // must always be let through, in every environment.
      if (!origin) {
        return callback(null, true);
      }

      if (isOriginAllowed(origin, { allowedOrigins: env.corsAllowedOrigins, allowLocalhost: env.allowLocalhostCors })) {
        return callback(null, true);
      }

      // A disallowed origin should receive a normal response without CORS
      // headers. Turning this into an Express error causes OPTIONS requests to
      // become 500s, which obscures the real issue and floods server logs.
      return callback(null, false);
    },
    credentials: true
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ──────────────────────────────────────────────
app.use(
  morgan(env.nodeEnv === "production" ? "combined" : "dev", {
    stream: { write: (msg) => logger.http?.(msg.trim()) || logger.info(msg.trim()) }
  })
);

// ── Rate limiting (general) ─────────────────────────────
app.use(`/api/${env.apiVersion}`, generalLimiter);

// ── Static file serving for local-driver uploads ────────
app.use(
  `/${env.storage.localUploadDir}`,
  express.static(env.storage.localUploadDir, { maxAge: "30d", immutable: true })
);

// ── Admin frontend served from backend under /admin ─────
const adminDir = path.join(__dirname, "../admin");
app.use("/admin", express.static(adminDir, { index: false }));
app.get(["/admin", "/admin/*"], (req, res) => {
  res.sendFile(path.join(adminDir, "admin.html"));
});

// ── Coach portal served from backend under /coach ───────
const coachDir = path.join(__dirname, "../coach");
app.use("/coach", express.static(coachDir, { index: false }));
app.get(["/coach", "/coach/*"], (req, res) => {
  res.sendFile(path.join(coachDir, "coach.html"));
});

// ── API docs ─────────────────────────────────────────────
// Swagger UI. `persistAuthorization` keeps the token across reloads. The
// response interceptor (serialized into the page, so it must be self-contained)
// picks the access token out of a successful login / verify-email / refresh
// call and authorizes the UI with it, so testers never copy tokens by hand.
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "FitNerve API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      // Serialised into the Swagger UI page and run in the browser, so `window` is the page's.
      /* eslint-disable no-undef */
      responseInterceptor: function (res) {
        try {
          var url = String(res.url || "").split("?")[0];
          if (res.status === 200 && /\/auth\/(login|verify-email|refresh)$/.test(url)) {
            var body = typeof res.body === "string" ? JSON.parse(res.body) : res.body;
            var token = body && body.data && body.data.accessToken;
            if (token && window.ui) {
              // The persist-aware variant also stores the token (persistAuthorization), so a reload keeps you logged in.
              window.ui.authActions.authorizeWithPersistOption({
                bearerAuth: { name: "bearerAuth", schema: { type: "http", scheme: "bearer" }, value: token }
              });
            }
          }
        } catch (e) {
          /* never break the response because of the helper */
        }
        return res;
      }
      /* eslint-enable no-undef */
    }
  })
);

// ── Versioned API ────────────────────────────────────────
app.use(`/api/${env.apiVersion}`, signS3Urls(), v1Routes);

app.get("/", (req, res) => {
  if (req.accepts("html") && !req.xhr && req.headers.accept && req.headers.accept.includes("text/html")) {
    return res.redirect("/admin");
  }
  res.json({ success: true, message: "FitNerve API is running", docs: "/api-docs", admin: "/admin", coach: "/coach" });
});

// ── 404 + centralized error handling (must be last) ─────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
