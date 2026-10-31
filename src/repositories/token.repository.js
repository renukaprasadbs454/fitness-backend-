const prisma = require("../database/prismaClient");

const tokenRepository = {
  // ── Refresh tokens ──────────────────────────────────────
  createRefreshToken: (data) => prisma.refreshToken.create({ data }),

  findRefreshToken: (token) => prisma.refreshToken.findUnique({ where: { token } }),

  revokeRefreshToken: (token, replacedByToken = null) =>
    prisma.refreshToken.update({
      where: { token },
      data: { revoked: true, replacedByToken }
    }),

  // Consume the old token and issue its replacement in one transaction so
  // concurrent refresh requests cannot both rotate the same session token.
  rotateRefreshToken: (oldToken, replacement, userId) =>
    prisma.$transaction(async (tx) => {
      const result = await tx.refreshToken.updateMany({
        where: { token: oldToken, userId, revoked: false, expiresAt: { gt: new Date() } },
        data: { revoked: true, replacedByToken: replacement.token }
      });
      if (result.count !== 1) return false;
      await tx.refreshToken.create({ data: replacement });
      return true;
    }),

  revokeAllUserTokens: (userId) =>
    prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true }
    }),

  // Housekeeping: tokens that expired before `before` can never be used again.
  deleteExpiredBefore: (before) => prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: before } } })
};

module.exports = tokenRepository;
