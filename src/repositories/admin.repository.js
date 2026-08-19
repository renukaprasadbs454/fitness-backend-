const prisma = require("../database/prismaClient");

const adminRepository = {
  createAuditLog: (adminId, action, targetType, targetId, metadata) =>
    prisma.adminAuditLog.create({
      data: { adminId, action, targetType, targetId, metadata }
    }),

  listAuditLogs: ({ skip, take, targetType, targetId }) =>
    prisma.adminAuditLog.findMany({
      where: {
        targetType: targetType || undefined,
        targetId: targetId || undefined
      },
      include: { admin: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countAuditLogs: ({ targetType, targetId }) =>
    prisma.adminAuditLog.count({
      where: { targetType: targetType || undefined, targetId: targetId || undefined }
    }),

  // ── Payments ─────────────────────────────────────────────
  listPayments: ({ skip, take, status, purpose }) =>
    prisma.payment.findMany({
      where: { status: status || undefined, purpose: purpose || undefined },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countPayments: ({ status, purpose }) =>
    prisma.payment.count({ where: { status: status || undefined, purpose: purpose || undefined } }),

  paymentTotals: async () => {
    const [succeeded, pending, refunded, failed] = await Promise.all([
      prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true }, _count: true }),
      prisma.payment.count({ where: { status: "PENDING" } }),
      prisma.payment.count({ where: { status: "REFUNDED" } }),
      prisma.payment.count({ where: { status: "FAILED" } })
    ]);
    return {
      totalRevenue: succeeded._sum.amount || 0,
      successfulCount: succeeded._count,
      pendingCount: pending,
      refundedCount: refunded,
      failedCount: failed
    };
  }
};

module.exports = adminRepository;
