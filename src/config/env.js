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
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      region: process.env.AWS_REGION || "ap-south-1",
      bucket: process.env.AWS_S3_BUCKET || "",
      endpoint: process.env.AWS_S3_ENDPOINT || "",
      forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
      publicUrlTemplate: process.env.AWS_S3_PUBLIC_URL_TEMPLATE || ""
    }
  },

  logLevel: process.env.LOG_LEVEL || "info"
};

module.exports = env;
