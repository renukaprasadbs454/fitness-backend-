const chatRepository = require("../repositories/chat.repository");
const coachRepository = require("../repositories/coach.repository");
const userRepository = require("../repositories/user.repository");
const storage = require("../utils/storage");
const ApiError = require("../utils/ApiError");
const { parsePagination, buildMeta } = require("../utils/pagination");
const notificationService = require("./notification.service");

function toMessageDto(message) {
  return {
    id: message.id,
    roomId: message.roomId,
    senderId: message.senderId,
    type: message.type,
    body: message.body,
    imageUrl: message.imageUrl,
    status: message.status,
    deliveredAt: message.deliveredAt,
    seenAt: message.seenAt,
    createdAt: message.createdAt
  };
}

function toRoomSummaryDto(room, viewerRole) {
  const lastMessage = room.messages?.[0] || null;
  if (viewerRole === "COACH") {
    return {
      id: room.id,
      participant: {
        id: room.user.id,
        name: room.user.fullName,
        avatarUrl: room.user.profile?.profileImageUrl || null
      },
      lastMessage: lastMessage ? toMessageDto(lastMessage) : null,
      lastMessageAt: room.lastMessageAt
    };
  }
  return {
    id: room.id,
    participant: {
      id: room.coach.id,
      name: room.coach.user.fullName,
      avatarUrl: room.coach.profileImageUrl || null
    },
    lastMessage: lastMessage ? toMessageDto(lastMessage) : null,
    lastMessageAt: room.lastMessageAt
  };
}

/**
 * Resolves (and lazily creates) the 1:1 room between a user and a coach.
 * `requester` is whoever is opening the chat; we figure out which side of
 * the pair they are and validate the other side actually exists.
 */
async function getOrCreateRoom(requester, otherPartyId) {
  let userId;
  let coachId;

  if (requester.role === "COACH") {
    const coach = await coachRepository.findByUserId(requester.id);
    if (!coach) throw ApiError.forbidden("Coach profile not found for this account");
    coachId = coach.id;
    userId = otherPartyId;
    const otherUser = await userRepository.findById(otherPartyId);
    if (!otherUser) throw ApiError.notFound("User not found");
  } else {
    userId = requester.id;
    const coach = await coachRepository.findById(otherPartyId);
    if (!coach) throw ApiError.notFound("Coach not found");
    coachId = coach.id;
  }

  let room = await chatRepository.findRoomByUserAndCoach(userId, coachId);
  if (!room) {
    room = await chatRepository.createRoom(userId, coachId);
  }
  return chatRepository.findRoomById(room.id);
}

async function listMyRooms(currentUser) {
  if (currentUser.role === "COACH") {
    const coach = await coachRepository.findByUserId(currentUser.id);
    if (!coach) return [];
    const rooms = await chatRepository.listRoomsForCoach(coach.id);
    return Promise.all(
      rooms.map(async (r) => ({
        ...toRoomSummaryDto(r, "COACH"),
        unreadCount: await chatRepository.unreadCountForRecipient(r.id, currentUser.id)
      }))
    );
  }
  const rooms = await chatRepository.listRoomsForUser(currentUser.id);
  return Promise.all(
    rooms.map(async (r) => ({
      ...toRoomSummaryDto(r, "USER"),
      unreadCount: await chatRepository.unreadCountForRecipient(r.id, currentUser.id)
    }))
  );
}

async function assertParticipant(roomId, currentUser) {
  const room = await chatRepository.findRoomById(roomId);
  if (!room) throw ApiError.notFound("Chat room not found");

  const isUserSide = room.userId === currentUser.id;
  const isCoachSide =
    currentUser.role === "COACH" &&
    (await coachRepository.findByUserId(currentUser.id))?.id === room.coachId;

  if (!isUserSide && !isCoachSide) {
    throw ApiError.forbidden("You are not a participant in this chat room");
  }
  return { room, isUserSide };
}

async function listMessages(roomId, currentUser, query) {
  const { room, isUserSide } = await assertParticipant(roomId, currentUser);
  const after = isUserSide ? room.userClearedAt : room.coachClearedAt;

  const { page, limit, skip } = parsePagination(query, { defaultLimit: 30, maxLimit: 100 });
  const [items, total] = await Promise.all([
    chatRepository.listMessages(roomId, { skip, take: limit, after }),
    chatRepository.countMessages(roomId, after)
  ]);
  return { items: items.map(toMessageDto).reverse(), meta: buildMeta(page, limit, total) };
}

/**
 * Per-viewer "clear chat" — hides history on the caller's side only,
 * matching the ChatRoom schema comment. Does not delete anything or
 * affect what the other participant sees.
 */
async function clearMessages(roomId, currentUser) {
  const { isUserSide } = await assertParticipant(roomId, currentUser);
  if (isUserSide) {
    await chatRepository.clearForUser(roomId);
  } else {
    await chatRepository.clearForCoach(roomId);
  }
}

/**
 * Persists a text or image message. Used by both the REST fallback
 * endpoint and the Socket.io gateway so behavior stays identical
 * regardless of transport.
 */
async function sendMessage(roomId, sender, { type = "TEXT", body, imageBuffer, imageMime, imageOriginalName }) {
  const { room } = await assertParticipant(roomId, sender);

  let imageUrl = null;
  if (type === "IMAGE") {
    if (!imageBuffer) throw ApiError.badRequest("Image file is required for IMAGE messages");
    const saved = await storage.saveFile(
      { buffer: imageBuffer, mimetype: imageMime, originalname: imageOriginalName || "chat-image" },
      "chat"
    );
    imageUrl = saved.url;
  } else {
    if (!body || !body.trim()) throw ApiError.badRequest("Message body cannot be empty");
  }

  const message = await chatRepository.createMessage({
    roomId,
    senderId: sender.id,
    type,
    body: type === "TEXT" ? body.trim() : null,
    imageUrl
  });
  await chatRepository.touchRoom(roomId, message.createdAt);

  const recipientId = room.userId === sender.id ? room.coach.userId : room.userId;
  await notificationService.notify(
    recipientId,
    "COACH_MESSAGE",
    "New message",
    type === "IMAGE" ? "Sent you a photo" : body.trim().slice(0, 120),
    { dispatchPush: true }
  );

  return { message: toMessageDto(message), recipientId };
}

async function markDelivered(roomId, currentUser) {
  await assertParticipant(roomId, currentUser);
  await chatRepository.markDelivered(roomId, currentUser.id);
}

async function markSeen(roomId, currentUser) {
  await assertParticipant(roomId, currentUser);
  await chatRepository.markSeen(roomId, currentUser.id);
}

module.exports = {
  getOrCreateRoom,
  listMyRooms,
  listMessages,
  sendMessage,
  markDelivered,
  markSeen,
  clearMessages,
  assertParticipant,
  toMessageDto
};
