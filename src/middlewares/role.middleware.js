const ApiError = require("../utils/ApiError");

/**
 * Restricts a route to the given roles. Must run after `authenticate`.
 * Usage: router.get("/admin-only", authenticate, requireRole("ADMIN"), handler)
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized());
  }
  if (!allowedRoles.includes(req.user.role)) {
    return next(ApiError.forbidden("You do not have permission to perform this action"));
  }
  next();
};

module.exports = { requireRole };
