const prisma = require("../database/prismaClient");

const platformIntegrationRepository = {
  findByProvider: (provider) => prisma.platformIntegration.findUnique({ where: { provider } }),

  upsert: (provider, data) =>
    prisma.platformIntegration.upsert({
      where: { provider },
      create: { provider, ...data },
      update: data
    }),

  deleteByProvider: (provider) => prisma.platformIntegration.deleteMany({ where: { provider } })
};

module.exports = platformIntegrationRepository;
