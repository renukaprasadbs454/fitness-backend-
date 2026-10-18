const prisma = require("../database/prismaClient");
const ApiError = require("../utils/ApiError");

const coachInclude = {
  user: { select: { fullName: true, email: true } },
  availability: true
};

async function listIds(userId) {
  const rows = await prisma.favoriteCoach.findMany({ where: { userId }, select: { coachId: true } });
  return rows.map((r) => r.coachId);
}

async function list(userId) {
  const rows = await prisma.favoriteCoach.findMany({
    where: { userId },
    include: { coach: { include: coachInclude } },
    orderBy: { createdAt: "desc" }
  });
  return rows.map((r) => r.coach);
}

async function add(userId, coachId) {
  const coach = await prisma.coach.findUnique({ where: { id: coachId }, select: { id: true, userId: true } });
  if (!coach) throw ApiError.notFound("Coach not found");
  if (coach.userId === userId) throw ApiError.badRequest("You can't favourite yourself");

  await prisma.favoriteCoach.upsert({
    where: { userId_coachId: { userId, coachId } },
    create: { userId, coachId },
    update: {}
  });
  return listIds(userId);
}

async function remove(userId, coachId) {
  await prisma.favoriteCoach.deleteMany({ where: { userId, coachId } });
  return listIds(userId);
}

module.exports = { listIds, list, add, remove };
