const prisma = require("../database/prismaClient");

const otpRepository = {
  createOtpCode: (data) => prisma.otpCode.create({ data }),

  findValidOtpCode: (userId, purpose) =>
    prisma.otpCode.findFirst({
      where: { userId, purpose, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    }),

  markOtpCodeUsed: (id) => prisma.otpCode.update({ where: { id }, data: { used: true } }),

  incrementAttempts: (id) =>
    prisma.otpCode.update({ where: { id }, data: { attempts: { increment: 1 } } }),

  invalidateActive: (userId, purpose) =>
    prisma.otpCode.updateMany({
      where: { userId, purpose, used: false },
      data: { used: true }
    }),

  // Housekeeping: codes that expired before `before` are dead weight.
  deleteExpiredBefore: (before) => prisma.otpCode.deleteMany({ where: { expiresAt: { lt: before } } })
};

module.exports = otpRepository;
