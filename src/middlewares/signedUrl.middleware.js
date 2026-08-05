const env = require("../config/env");
const { resolveReadUrl } = require("../utils/storage");

// Recursively re-signs every string in a response body that matches one of
// our own stored S3 URLs (profile images, chat images, content covers, ...).
// Applied once globally instead of touching every service that returns a
// media URL — resolveReadUrl() is a cheap no-op for anything that isn't one
// of ours (local /uploads paths pass through untouched).
//
// Only recurses into plain objects/arrays. `typeof value === "object"` is
// also true for Date, Prisma's Decimal, Buffer, etc. — those store their
// value internally rather than as enumerable own properties, so naively
// doing Object.entries() on them (as an earlier version of this file did)
// silently turned every Date into `{}`. Object.prototype.toString reliably
// distinguishes a genuine plain object from those.
function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function deepResign(value) {
  if (typeof value === "string") {
    return resolveReadUrl(value);
  }
  if (Array.isArray(value)) {
    return value.map(deepResign);
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = deepResign(val);
    }
    return out;
  }
  return value;
}

function signS3Urls() {
  return (req, res, next) => {
    if (env.storage.driver !== "s3") {
      return next();
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => originalJson(deepResign(body));
    next();
  };
}

module.exports = { signS3Urls };
