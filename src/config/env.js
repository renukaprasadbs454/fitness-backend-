require("dotenv").config();

function required(key, fallback = undefined) {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    // Fail fast at boot rather than deep inside a request handler.
    // eslint-disable-next-line no-console
    console.error(`[config] Missing required env var: ${key}`);
    process.exit(1);
  }
  return value;
}

/**
 * Builds the Nodemailer "from" header. SMTP_FROM_NAME is optional; when set the
 * address becomes `FitNerve <account@gmail.com>`. Gmail rewrites the address to
 * the authenticated account anyway, so the sender name is the only part that
 * actually varies.
 */
function buildFromAddress() {
  const address = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "";
  const name = process.env.SMTP_FROM_NAME || "";
  if (!address) return "onboarding@example.com";
  return name ? `${name} <${address}>` : address;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),
  apiVersion: process.env.API_VERSION || "v1",

  databaseUrl: required("DATABASE_URL"),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshSecret: required("JWT_REFRESH_SECRET"),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d"
  },

  passwordReset: {
    tokenExpiresMin: parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MIN || "30", 10),
    urlBase: process.env.PASSWORD_RESET_URL_BASE || "http://localhost:3000/reset-password"
  },

  otp: {
    expiresMin: parseInt(process.env.OTP_EXPIRES_MIN || "10", 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10)
  },

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10),

  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  rateLimit: {
    windowMin: parseInt(process.env.RATE_LIMIT_WINDOW_MIN || "15", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || "10", 10)
  },

  storage: {
    driver: process.env.STORAGE_DRIVER || "local",
    localUploadDir: process.env.LOCAL_UPLOAD_DIR || "uploads",
    maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || "5", 10),
    aws: {
      // Reads the S3_* names (not AWS_*) since that's what's actually
      // configured — this project uses Tigris (t3.storage.dev), an
      // S3-compatible provider, not real AWS S3.
      accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
      region: process.env.S3_REGION || process.env.AWS_REGION || "auto",
      bucket: process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "",
      endpoint: process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || "",
      // Non-AWS S3-compatible endpoints (Tigris, MinIO, R2, etc.) need
      // path-style addressing (endpoint/bucket/key) by default — virtual-
      // hosted style (bucket.endpoint/key) is an AWS-specific convention.
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE
        ? process.env.S3_FORCE_PATH_STYLE === "true"
        : Boolean(process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT),
      publicUrlTemplate: process.env.S3_PUBLIC_URL_TEMPLATE || process.env.AWS_S3_PUBLIC_URL_TEMPLATE || ""
    }
  },

  email: {
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
    smtpUser: process.env.SMTP_USER || "",
    // SMTP_PASSWORD / SMTP_FROM_EMAIL are the names used in .env; the shorter
    // SMTP_PASS / EMAIL_FROM are accepted too so existing deployments that set
    // either spelling keep working.
    smtpPass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "",
    fromAddress: buildFromAddress()
  },

  google: {
    androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || "",
    iosClientId: process.env.GOOGLE_IOS_CLIENT_ID || "",
    webClientId: process.env.GOOGLE_WEB_CLIENT_ID || "",
    // Only the Web client type is issued a secret by Google; Android/iOS
    // clients are public and rely on PKCE instead. Leave unset unless the
    // Web client is actually used for the exchange.
    webClientSecret: process.env.GOOGLE_WEB_CLIENT_SECRET || "",
    scopes: process.env.GOOGLE_CALENDAR_SCOPES || "https://www.googleapis.com/auth/calendar.readonly",
    // 32-byte key, hex-encoded (64 hex chars) — generate with `openssl rand -hex 32`.
    tokenEncryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || ""
  },

  logLevel: process.env.LOG_LEVEL || "info",

  firebase: {
    serviceAccountBase64: process.env.FCM_SERVICE_ACCOUNT_BASE64 || ""
  },

  cron: {
    enabled: process.env.ENABLE_CRON === "true",
    // "HH:mm" 24h local server time — reminder sweep for workouts/appointments
    reminderSweepCron: process.env.REMINDER_SWEEP_CRON || "*/15 * * * *"
  }
};

module.exports = env;
