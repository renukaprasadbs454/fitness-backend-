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
    })
};

module.exports = adminRepository;
