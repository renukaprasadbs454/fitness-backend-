const { Prisma } = require("@prisma/client");
const ApiError = require("../utils/ApiError");
const httpStatus = require("../constants/httpStatus");
const logger = require("../config/logger");
const env = require("../config/env");

/** Converts known non-ApiError exceptions (Prisma, JSON parse, Multer, etc.) into ApiError. */
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = err.meta?.target?.join(", ") || "field";
      return ApiError.conflict(`A record with this ${target} already exists`);
    }
    if (err.code === "P2025") {
      return ApiError.notFound("Record not found");
    }
    return ApiError.badRequest("Database request error");
  }

  if (err.type === "entity.parse.failed") {
    return ApiError.badRequest("Malformed JSON body");
  }

  if (err.name === "MulterError") {
    return ApiError.badRequest(`Upload error: ${err.message}`);
  }

  return ApiError.internal(err.message || "Internal server error");
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const apiError = normalizeError(err);

  if (!apiError.isOperational || apiError.statusCode >= 500) {
    logger.error(err.stack || err.message, { path: req.originalUrl, method: req.method });
  } else {
    logger.warn(`${apiError.statusCode} ${apiError.message}`, {
      path: req.originalUrl,
      method: req.method
    });
  }

  res.status(apiError.statusCode || httpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: apiError.message,
    details: apiError.details && apiError.details.length ? apiError.details : undefined,
    stack: env.nodeEnv === "development" ? err.stack : undefined
  });
}

function notFoundHandler(req, res) {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

module.exports = { errorHandler, notFoundHandler };
