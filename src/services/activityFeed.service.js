const prisma = require("../database/prismaClient");

/**
 * Records an entry in the user's activity feed (powers the dashboard
 * "recent activity" list and GET /activity/report).
 * Fire-and-forget from calling services — failures here should never
 * block the primary operation, so callers may choose not to await this.
 */
async function record(userId, type, description) {
  return prisma.activityLog.create({
    data: { userId, type, description }
  });
}

module.exports = { record };
