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

const app = express();

// ── Security & parsing ──────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        frameSrc: ["'self'", "http://localhost:5555"],
        connectSrc: ["'self'", "http://localhost:4000", "https://localhost:4000"],
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
      // Expo's web dev server picks whatever port is free (8081, 8082, ...),
      // so hardcoding one port in CORS_ALLOWED_ORIGINS breaks the moment it
      // picks a different one. In dev, allow any localhost/127.0.0.1 origin
      // regardless of port; production still enforces the explicit allowlist.
      const isLocalhostDev =
        env.nodeEnv !== "production" && (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

      if (isLocalhostDev || !env.corsAllowedOrigins.length || env.corsAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
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
app.use(`/${env.storage.localUploadDir}`, express.static(env.storage.localUploadDir));

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
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Versioned API ────────────────────────────────────────
app.use(`/api/${env.apiVersion}`, signS3Urls(), v1Routes);

app.get("/", (req, res) => {
  res.json({ success: true, message: "FitNerve API is running", docs: "/api-docs", admin: "/admin", coach: "/coach" });
});

// ── 404 + centralized error handling (must be last) ─────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
