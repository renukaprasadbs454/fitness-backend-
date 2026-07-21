const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyAccessToken } = require("../utils/jwt");
const prisma = require("../database/prismaClient");

/**
 * Verifies the Bearer access token, loads the user, and attaches it to req.user.
 * Rejects if the user no longer exists or has been deactivated.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Missing or malformed Authorization header");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === "TokenExpiredError" ? "Access token expired" : "Invalid access token"
    );
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized("User no longer exists or is deactivated");
  }

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
});

module.exports = { authenticate };
