const prisma = require("../database/prismaClient");

const planInclude = {
  plan: true,
  user: { select: { id: true, fullName: true, email: true } },
  assignedByUser: { select: { id: true, fullName: true, email: true } }
};

const assignedWorkoutRepository = {
  createPlanAssignment: ({ userId, assignedByUserId, createdByUserId, planId, note, scheduledAt }) =>
    prisma.assignedWorkoutPlan.create({
      data: { userId, assignedByUserId, createdByUserId, planId, note, scheduledAt },
      include: planInclude
    }),

  // Either side of the assignment — the sender (or whoever actually sent it,
  // if attributed to a coach), or the recipient — counts as a party to it,
  // so they can all view/modify/delete it.
  findPlanAssignmentByIdForParty: (id, partyUserId) =>
    prisma.assignedWorkoutPlan.findFirst({
      where: {
        id,
        OR: [{ assignedByUserId: partyUserId }, { createdByUserId: partyUserId }, { userId: partyUserId }]
      },
      include: planInclude
    }),

  updatePlanAssignment: (id, { note, scheduledAt }) =>
    prisma.assignedWorkoutPlan.update({
      where: { id },
      data: { note, scheduledAt },
      include: planInclude
    }),

  deletePlanAssignment: (id) => prisma.assignedWorkoutPlan.delete({ where: { id } }),

  // "Sent by" a user means they actually created it (createdByUserId), which
  // falls back to assignedByUserId for rows predating that column so
  // pre-existing history still shows up.
  listPlanAssignmentsForAssigner: (userId, { skip, take }) =>
    prisma.assignedWorkoutPlan.findMany({
      where: { OR: [{ createdByUserId: userId }, { createdByUserId: null, assignedByUserId: userId }] },
      include: planInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countPlanAssignmentsForAssigner: (userId) =>
    prisma.assignedWorkoutPlan.count({
      where: { OR: [{ createdByUserId: userId }, { createdByUserId: null, assignedByUserId: userId }] }
    }),

  listPlanAssignmentsForUser: (userId) =>
    prisma.assignedWorkoutPlan.findMany({
      where: { userId },
      include: {
        plan: true,
        assignedByUser: { select: { fullName: true } }
      },
      orderBy: { createdAt: "desc" }
    }),

  // A custom workout can be modified/removed by whoever sent it.
  findCustomByIdForAssigner: (id, assignerUserId) =>
    prisma.customWorkout.findFirst({
      where: { id, OR: [{ createdByUserId: assignerUserId }, { assignedByUserId: assignerUserId }] },
      include: {
        exercises: { orderBy: { sortOrder: "asc" } },
        user: { select: { id: true, fullName: true, email: true } }
      }
    }),

  listCustomAssignedByUser: (userId, { skip, take }) =>
    prisma.customWorkout.findMany({
      where: { OR: [{ createdByUserId: userId }, { createdByUserId: null, assignedByUserId: userId }] },
      include: {
        exercises: { orderBy: { sortOrder: "asc" } },
        user: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countCustomAssignedByUser: (userId) =>
    prisma.customWorkout.count({
      where: { OR: [{ createdByUserId: userId }, { createdByUserId: null, assignedByUserId: userId }] }
    })
};

module.exports = assignedWorkoutRepository;
