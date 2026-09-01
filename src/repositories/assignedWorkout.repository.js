const prisma = require("../database/prismaClient");

const planInclude = {
  plan: true,
  user: { select: { id: true, fullName: true, email: true } },
  assignedByUser: { select: { id: true, fullName: true, email: true } }
};

const assignedWorkoutRepository = {
  createPlanAssignment: ({ userId, assignedByUserId, planId, note, scheduledAt }) =>
    prisma.assignedWorkoutPlan.create({
      data: { userId, assignedByUserId, planId, note, scheduledAt },
      include: planInclude
    }),

  findPlanAssignmentByIdForAssigner: (id, assignedByUserId) =>
    prisma.assignedWorkoutPlan.findFirst({ where: { id, assignedByUserId }, include: planInclude }),

  // Either side of the assignment — the sender or the recipient — counts as
  // a party to it, so they can both view/modify/delete it.
  findPlanAssignmentByIdForParty: (id, partyUserId) =>
    prisma.assignedWorkoutPlan.findFirst({
      where: { id, OR: [{ assignedByUserId: partyUserId }, { userId: partyUserId }] },
      include: planInclude
    }),

  updatePlanAssignment: (id, { note, scheduledAt }) =>
    prisma.assignedWorkoutPlan.update({
      where: { id },
      data: { note, scheduledAt },
      include: planInclude
    }),

  deletePlanAssignment: (id) => prisma.assignedWorkoutPlan.delete({ where: { id } }),

  listPlanAssignmentsForAssigner: (assignedByUserId, { skip, take }) =>
    prisma.assignedWorkoutPlan.findMany({
      where: { assignedByUserId },
      include: planInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countPlanAssignmentsForAssigner: (assignedByUserId) => prisma.assignedWorkoutPlan.count({ where: { assignedByUserId } }),

  listPlanAssignmentsForUser: (userId) =>
    prisma.assignedWorkoutPlan.findMany({
      where: { userId },
      include: {
        plan: true,
        assignedByUser: { select: { fullName: true } }
      },
      orderBy: { createdAt: "desc" }
    }),

  listCustomAssignedByUser: (assignedByUserId, { skip, take }) =>
    prisma.customWorkout.findMany({
      where: { assignedByUserId },
      include: {
        exercises: { orderBy: { sortOrder: "asc" } },
        user: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countCustomAssignedByUser: (assignedByUserId) => prisma.customWorkout.count({ where: { assignedByUserId } })
};

module.exports = assignedWorkoutRepository;
