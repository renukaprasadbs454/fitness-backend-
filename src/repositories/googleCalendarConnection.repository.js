const prisma = require("../database/prismaClient");

const googleCalendarConnectionRepository = {
  findByUserId: (userId) => prisma.googleCalendarConnection.findUnique({ where: { userId } }),

  upsertForUser: (userId, data) =>
    prisma.googleCalendarConnection.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data
    }),

  // deleteMany (not delete) so disconnecting a user with no connection is a no-op, not a 404.
  deleteForUser: (userId) => prisma.googleCalendarConnection.deleteMany({ where: { userId } })
};

module.exports = googleCalendarConnectionRepository;
