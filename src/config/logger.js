const winston = require("winston");
const env = require("./env");

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Forces IST regardless of the host machine's system timezone, so logs read
// the same in local dev (any OS timezone) as they will in production.
// 12-hour clock for log readability — API responses keep the 24-hour ISO
// format from utils/timezone.js, which is the correct wire format.
const istTimestamp = () =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  })
    .format(new Date())
    .replace(",", "");

const devFormat = combine(
  colorize(),
  timestamp({ format: istTimestamp }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${ts} [${level}]: ${stack || message}${metaStr}`;
  })
);

const prodFormat = combine(timestamp({ format: istTimestamp }), errors({ stack: true }), json());

const logger = winston.createLogger({
  level: env.logLevel,
  format: env.nodeEnv === "production" ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" })
  ],
  exitOnError: false
});

module.exports = logger;
