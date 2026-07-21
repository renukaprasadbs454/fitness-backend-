const prisma = require("../database/prismaClient");

const chatRepository = {
  findRoomByUserAndCoach: (userId, coachId) =>
    prisma.chatRoom.findUnique({ where: { userId_coachId: { userId, coachId } } }),

  createRoom: (userId, coachId) => prisma.chatRoom.create({ data: { userId, coachId } }),

  findRoomById: (id) =>
    prisma.chatRoom.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, profile: { select: { profileImageUrl: true } } } },
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
        user: { select: { id: true, fullName: true, profile: { select: { profileImageUrl: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    }),

  touchRoom: (id, when) => prisma.chatRoom.update({ where: { id }, data: { lastMessageAt: when } }),

  createMessage: (data) => prisma.chatMessage.create({ data }),

  listMessages: (roomId, { skip, take }) =>
    prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countMessages: (roomId) => prisma.chatMessage.count({ where: { roomId } }),

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
