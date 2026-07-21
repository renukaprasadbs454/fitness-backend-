const prisma = require("../database/prismaClient");

const bmiRepository = {
  create: (data) => prisma.bmiLog.create({ data }),

  list: (userId, { skip, take }) =>
    prisma.bmiLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  count: (userId) => prisma.bmiLog.count({ where: { userId } }),

  latest: (userId) =>
    prisma.bmiLog.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } })
};

module.exports = bmiRepository;
