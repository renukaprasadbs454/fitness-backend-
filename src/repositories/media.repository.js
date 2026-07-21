const prisma = require("../database/prismaClient");

const mediaRepository = {
  create: (data) => prisma.media.create({ data }),

  findById: (id) => prisma.media.findUnique({ where: { id } }),

  listByUser: (userId, type) =>
    prisma.media.findMany({
      where: { userId, ...(type ? { type } : {}) },
      orderBy: { createdAt: "desc" }
    }),

  delete: (id) => prisma.media.delete({ where: { id } })
};

module.exports = mediaRepository;
