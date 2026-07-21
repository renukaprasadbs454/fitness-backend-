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
const { errorHandler, notFoundHandler } = require("./middlewares/error.middleware");

const app = express();

// ── Security & parsing ──────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.corsAllowedOrigins.length ? env.corsAllowedOrigins : true,
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
  res.sendFile(path.join(adminDir, "index.html"));
});

// ── API docs ─────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Versioned API ────────────────────────────────────────
app.use(`/api/${env.apiVersion}`, v1Routes);

app.get("/", (req, res) => {
  res.json({ success: true, message: "FitNerve API is running", docs: "/api-docs", admin: "/admin" });
});

// ── 404 + centralized error handling (must be last) ─────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
