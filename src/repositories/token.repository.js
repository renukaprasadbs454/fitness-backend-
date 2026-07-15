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

  revokeAllUserTokens: (userId) =>
    prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true }
    }),

  // ── Password reset tokens ───────────────────────────────
  createPasswordResetToken: (data) => prisma.passwordResetToken.create({ data }),

  findValidPasswordResetToken: (tokenHash) =>
    prisma.passwordResetToken.findFirst({
      where: { tokenHash, used: false, expiresAt: { gt: new Date() } }
    }),

  markPasswordResetTokenUsed: (id) =>
    prisma.passwordResetToken.update({ where: { id }, data: { used: true } })
};

module.exports = tokenRepository;
