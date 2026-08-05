// Lightweight in-process TTL response cache for read-heavy, low-churn reference
// data (workout plans, coach directory, published content). Single-instance
// only — fine for the current single-process deployment; would need a shared
// store (e.g. Redis) if this API ever runs behind multiple instances.
const store = new Map(); // url -> { expiresAt, statusCode, body }

function cacheResponse(ttlSeconds) {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cached = store.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return res.status(cached.statusCode).json(cached.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, statusCode: res.statusCode, body });
      }
      return originalJson(body);
    };

    next();
  };
}

// Drops every cached entry whose URL starts with `prefix`. Wired in front of
// mutation routes for the same resource so a create/update/delete can never
// serve stale cached reads afterward.
function invalidate(prefix) {
  return (req, res, next) => {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
    next();
  };
}

module.exports = { cacheResponse, invalidate };
