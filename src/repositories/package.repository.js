const prisma = require("../database/prismaClient");

const ORDER = [{ sortOrder: "asc" }, { createdAt: "asc" }];

const packageRepository = {
  listActive: () => prisma.package.findMany({ where: { isActive: true }, orderBy: ORDER }),
  listAll: () => prisma.package.findMany({ orderBy: ORDER }),
  findById: (id) => prisma.package.findUnique({ where: { id } }),
  create: (data) => prisma.package.create({ data }),
  update: (id, data) => prisma.package.update({ where: { id }, data }),
  delete: (id) => prisma.package.delete({ where: { id } }),

  createPayment: (data) => prisma.payment.create({ data })
};

module.exports = packageRepository;
