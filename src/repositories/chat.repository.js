const prisma = require("../database/prismaClient");

const chatRepository = {
  findRoomByUserAndCoach: (userId, coachId) =>
    prisma.chatRoom.findUnique({ where: { userId_coachId: { userId, coachId } } }),

  createRoom: (userId, coachId) => prisma.chatRoom.create({ data: { userId, coachId } }),

  findRoomById: (id) =>
    prisma.chatRoom.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, isActive: true, assignedCoachId: true, profile: { select: { profileImageUrl: true } } } },
        coach: {
          select: {
            id: true,
            userId: true,
            profileImageUrl: true,
            user: { select: { id: true, fullName: true } }
          }
        }
      }
    }),

  // Rooms for a given participant, regardless of whether they're the
  // "user" side or the "coach" side of the pair — driven by role in the service layer.
  listRoomsForUser: (userId) =>
    prisma.chatRoom.findMany({
      where: { userId },
      orderBy: { lastMessageAt: "desc" },
      include: {
        coach: { select: { id: true, profileImageUrl: true, user: { select: { fullName: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    }),

  listRoomsForCoach: (coachId) =>
    prisma.chatRoom.findMany({
      where: { coachId },
      orderBy: { lastMessageAt: "desc" },
      include: {
        user: { select: { id: true, fullName: true, isActive: true, assignedCoachId: true, profile: { select: { profileImageUrl: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    }),

  // Head coach oversight: every conversation on the platform.
  listAllRooms: () =>
    prisma.chatRoom.findMany({
      orderBy: { lastMessageAt: "desc" },
      include: {
        user: { select: { id: true, fullName: true, profile: { select: { profileImageUrl: true } } } },
        coach: { select: { id: true, userId: true, user: { select: { fullName: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    }),

  // Sessions that qualify the user for a chat with a coach: booked or completed, never cancelled.
  qualifyingSessions: (userId) =>
    prisma.appointment.findMany({
      where: { userId, status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] } },
      select: { coachId: true, createdAt: true }
    }),

  // The same sessions seen from a coach: per client, when their latest qualifying one was booked.
  latestQualifyingSessionByClient: (coachId) =>
    prisma.appointment.groupBy({
      by: ["userId"],
      where: { coachId, status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] } },
      _max: { createdAt: true }
    }),

  // Rooms the user was swapped away from, with when that happened.
  closedRoomsForUser: (userId) =>
    prisma.chatRoom.findMany({ where: { userId, closedForUserAt: { not: null } }, select: { coachId: true, closedForUserAt: true } }),

  // Clients who were swapped away from this coach, with when that happened.
  closedRoomsForCoach: (coachId) =>
    prisma.chatRoom.findMany({ where: { coachId, closedForUserAt: { not: null } }, select: { userId: true, closedForUserAt: true } }),

  closeRoomForUser: (userId, coachId) =>
    prisma.chatRoom.updateMany({ where: { userId, coachId }, data: { closedForUserAt: new Date() } }),

  hasMessageFrom: async (roomId, senderId, body) =>
    Boolean(await prisma.chatMessage.findFirst({ where: { roomId, senderId, body }, select: { id: true } })),

  touchRoom: (id, when) => prisma.chatRoom.update({ where: { id }, data: { lastMessageAt: when } }),

  createMessage: (data) => prisma.chatMessage.create({ data }),

  listMessages: (roomId, { skip, take, after }) =>
    prisma.chatMessage.findMany({
      where: { roomId, createdAt: after ? { gt: after } : undefined },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countMessages: (roomId, after) =>
    prisma.chatMessage.count({ where: { roomId, createdAt: after ? { gt: after } : undefined } }),

  // "Clear chat" is per-viewer — hides history on one side without
  // deleting it for the other participant (see ChatRoom schema comment).
  clearForUser: (roomId) => prisma.chatRoom.update({ where: { id: roomId }, data: { userClearedAt: new Date() } }),

  clearForCoach: (roomId) => prisma.chatRoom.update({ where: { id: roomId }, data: { coachClearedAt: new Date() } }),

  markDelivered: (roomId, recipientId) =>
    prisma.chatMessage.updateMany({
      where: { roomId, senderId: { not: recipientId }, status: "SENT" },
      data: { status: "DELIVERED", deliveredAt: new Date() }
    }),

  markSeen: (roomId, recipientId) =>
    prisma.chatMessage.updateMany({
      where: { roomId, senderId: { not: recipientId }, status: { in: ["SENT", "DELIVERED"] } },
      data: { status: "SEEN", seenAt: new Date() }
    }),

  unreadCountForRecipient: (roomId, recipientId) =>
    prisma.chatMessage.count({
      where: { roomId, senderId: { not: recipientId }, status: { not: "SEEN" } }
    })
};

module.exports = chatRepository;
