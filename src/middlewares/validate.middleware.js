const ApiError = require("../utils/ApiError");

/**
 * Validates req.body / req.query / req.params against Zod schemas.
 * Usage: router.post("/x", validate({ body: schema }), handler)
 */
const validate = (schemas) => (req, res, next) => {
  const targets = ["body", "query", "params"];
  for (const target of targets) {
    const schema = schemas[target];
    if (!schema) continue;

    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }));
      return next(ApiError.badRequest("Validation failed", details));
    }
    req[target] = result.data;
  }
  next();
};

module.exports = validate;
