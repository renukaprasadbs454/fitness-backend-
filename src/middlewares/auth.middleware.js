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

  // New access tokens are tied to their refresh-token row. That lets logout,
  // password resets, and admin session revocation take effect immediately.
  // Tokens issued before this check was added remain valid until their short
  // access-token expiry, preserving in-flight sessions during rollout.
  let user;
  if (payload.sid) {
    const session = await prisma.refreshToken.findUnique({
      where: { id: payload.sid },
      include: { user: true }
    });
    if (!session || session.userId !== payload.sub || session.revoked || session.expiresAt <= new Date()) {
      throw ApiError.unauthorized("Your session has ended. Please sign in again.");
    }
    user = session.user;
  } else {
    user = await prisma.user.findUnique({ where: { id: payload.sub } });
  }
  if (!user || !user.isActive) {
    throw ApiError.unauthorized("User no longer exists or is deactivated");
  }

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
});

module.exports = { authenticate };
