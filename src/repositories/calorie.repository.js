const prisma = require("../database/prismaClient");

const calorieRepository = {
  create: (data) => prisma.calorieLog.create({ data }),

  list: (userId, { skip, take }) =>
    prisma.calorieLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  count: (userId) => prisma.calorieLog.count({ where: { userId } }),

  latest: (userId) =>
    prisma.calorieLog.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } })
};

module.exports = calorieRepository;
