/**
 * Shared pagination query parser used across Phase 2 list endpoints.
 */
function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

function buildMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}

module.exports = { parsePagination, buildMeta };
