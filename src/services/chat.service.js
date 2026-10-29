const chatRepository = require("../repositories/chat.repository");
const coachRepository = require("../repositories/coach.repository");
const userRepository = require("../repositories/user.repository");
const storage = require("../utils/storage");
const ApiError = require("../utils/ApiError");
const { parsePagination, buildMeta } = require("../utils/pagination");
const notificationService = require("./notification.service");

// Sent from the coach in Chats the moment an admin assigns a user to them.
const ASSIGNMENT_WELCOME_MESSAGE = "Welcome! I'm your coach. Feel free to message me here whenever you need guidance.";

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
      coach: room.coach?.user ? { id: room.coach.id, name: room.coach.user.fullName } : undefined,
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
// A client's Chats tab only lists coaches they have booked (or completed) a session with,
// plus the coach an admin assigned to them. Cancelled or never-booked coaches stay out.
async function chatEligibleCoachIds(userId) {
  const [sessions, closed, user] = await Promise.all([
    chatRepository.qualifyingSessions(userId),
    chatRepository.closedRoomsForUser(userId),
    userRepository.findById(userId)
  ]);
  const closedAt = new Map(closed.map((r) => [r.coachId, r.closedForUserAt]));

  const eligible = new Set();
  for (const s of sessions) {
    const closure = closedAt.get(s.coachId);
    // After a swap, only sessions booked after the closure bring the chat back.
    if (!closure || s.createdAt > closure) eligible.add(s.coachId);
  }
  if (user?.assignedCoachId) eligible.add(user.assignedCoachId);
  return eligible;
}

// The same rule from the coach's side: the clients currently working with this coach.
async function eligibleClientIdsForCoach(coachId) {
  const [assignedIds, sessions, closed] = await Promise.all([
    userRepository.listClientIdsOfCoach(coachId),
    chatRepository.latestQualifyingSessionByClient(coachId),
    chatRepository.closedRoomsForCoach(coachId)
  ]);
  const closedAt = new Map(closed.map((r) => [r.userId, r.closedForUserAt]));

  const eligible = new Set(assignedIds);
  for (const s of sessions) {
    const closure = closedAt.get(s.userId);
    if (!closure || s._max.createdAt > closure) eligible.add(s.userId);
  }
  return eligible;
}

async function getOrCreateRoom(requester, otherPartyId, { coachId: chosenCoachId } = {}) {
  let userId;
  let coachId;
  let otherUser;
  let isHead = false;

  if (requester.role === "COACH") {
    const coach = await coachRepository.findByUserId(requester.id);
    if (!coach) throw ApiError.forbidden("Coach profile not found for this account");
    isHead = Boolean(coach.isHeadCoach);
    coachId = coach.id;
    // The head coach can open (or start) a conversation between any coach and any client.
    if (chosenCoachId && chosenCoachId !== coach.id) {
      if (!isHead) throw ApiError.forbidden("Only the head coach can open a chat for another coach");
      const chosen = await coachRepository.findById(chosenCoachId);
      if (!chosen) throw ApiError.notFound("Coach not found");
      coachId = chosen.id;
    }
    userId = otherPartyId;
    otherUser = await userRepository.findById(otherPartyId);
    if (!otherUser) throw ApiError.notFound("User not found");
  } else {
    userId = requester.id;
    const coach = await coachRepository.findById(otherPartyId);
    if (!coach) throw ApiError.notFound("Coach not found");
    coachId = coach.id;
  }

  let room = await chatRepository.findRoomByUserAndCoach(userId, coachId);
  if (requester.role === "USER" || requester.role === "ADMIN") {
    const user = await userRepository.findById(userId);
    if (requester.role === "USER" && user?.assignedCoachId && user.assignedCoachId !== coachId) {
      throw ApiError.forbidden("You can only chat with your currently assigned coach.");
    }
    if (requester.role === "USER" && !(await chatEligibleCoachIds(userId)).has(coachId)) {
      throw ApiError.forbidden("Book a session with this coach to start a chat.");
    }
  }
  if (!room) {
    // A coach can only start a *new* conversation with a user assigned to them.
    // A client can start one only with a coach they have booked (checked above).
    if (otherUser && !isHead && otherUser.assignedCoachId !== coachId) {
      throw ApiError.forbidden("You can only start a chat with users assigned to you");
    }
    room = await chatRepository.createRoom(userId, coachId);
  }
  return chatRepository.findRoomById(room.id);
}

async function listMyRooms(currentUser, { all = false } = {}) {
  if (currentUser.role === "COACH") {
    const coach = await coachRepository.findByUserId(currentUser.id);
    if (!coach) return [];
    const viewAll = all && coach.isHeadCoach;
    const rooms = viewAll
      ? await chatRepository.listAllRooms()
      : (await chatRepository.listRoomsForCoach(coach.id)).filter((r) => coach.isHeadCoach || r.user?.isActive && r.user?.assignedCoachId === coach.id);
    return Promise.all(
      rooms.map(async (r) => ({
        ...toRoomSummaryDto(r, "COACH"),
        // Unread counts only make sense for the coach the conversation belongs to.
        unreadCount: !viewAll || r.coachId === coach.id ? await chatRepository.unreadCountForRecipient(r.id, currentUser.id) : 0,
        isMine: r.coachId === coach.id
      }))
    );
  }
  const eligible = currentUser.role === "ADMIN" ? null : await chatEligibleCoachIds(currentUser.id);
  const rooms = (await chatRepository.listRoomsForUser(currentUser.id)).filter((r) => !eligible || eligible.has(r.coachId));
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

  let isOverseer = false;
  if (!isUserSide && !isCoachSide && currentUser.role === "COACH") {
    isOverseer = Boolean((await coachRepository.findByUserId(currentUser.id))?.isHeadCoach);
  }

  if (!isUserSide && !isCoachSide && !isOverseer) {
    throw ApiError.forbidden("You are not a participant in this chat room");
  }
  // A client can only use the currently assigned coach's room. This invalidates
  // old room access immediately after reassignment, including direct API/socket use.
  if (isUserSide && currentUser.role === "USER") {
    const user = await userRepository.findById(currentUser.id);
    if (room.closedForUserAt || !user?.assignedCoachId || user.assignedCoachId !== room.coachId) {
      throw ApiError.forbidden("This chat is no longer available because your coach changed");
    }
  }
  return { room, isUserSide, isParticipant: isUserSide || isCoachSide };
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
  const { isUserSide, isParticipant } = await assertParticipant(roomId, currentUser);
  if (!isParticipant) throw ApiError.forbidden("You can only clear your own conversations");
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

/**
 * Sent on the coach's behalf when an admin assigns a user to them, so the user
 * finds a conversation waiting in their Chats tab. The room is created if needed.
 */
async function sendCoachAssignmentMessage(userId, coachId) {
  const [coach, user] = await Promise.all([coachRepository.findById(coachId), userRepository.findById(userId)]);
  if (!coach || !user) return null;

  const coachSender = { id: coach.userId, role: "COACH" };
  const room = await getOrCreateRoom(coachSender, userId);

  const body = ASSIGNMENT_WELCOME_MESSAGE;

  return sendMessage(room.id, coachSender, { type: "TEXT", body });
}

/**
 * Sends the coach's custom booking message (if they set one) to the client who
 * just booked a session. The room may not exist yet: users can message any
 * coach, so it is created here directly rather than through the coach-side
 * "assigned clients only" rule.
 */
async function sendBookingMessage(userId, coachId) {
  const coach = await coachRepository.findById(coachId);
  if (!coach) return null;

  // A coach who hasn't written their own note sends the standard welcome instead.
  const custom = coach.bookingMessage?.trim();
  const text = custom || ASSIGNMENT_WELCOME_MESSAGE;

  let room = await chatRepository.findRoomByUserAndCoach(userId, coachId);
  if (!room) room = await chatRepository.createRoom(userId, coachId);

  // The standard welcome is sent once per conversation (an admin assignment may already have sent it);
  // a coach's own custom note goes out with every booking.
  if (!custom && (await chatRepository.hasMessageFrom(room.id, coach.userId, ASSIGNMENT_WELCOME_MESSAGE))) return null;

  return sendMessage(room.id, { id: coach.userId, role: "COACH" }, { type: "TEXT", body: text });
}

async function markDelivered(roomId, currentUser) {
  const { isParticipant } = await assertParticipant(roomId, currentUser);
  if (isParticipant) await chatRepository.markDelivered(roomId, currentUser.id);
}

async function markSeen(roomId, currentUser) {
  const { isParticipant } = await assertParticipant(roomId, currentUser);
  if (isParticipant) await chatRepository.markSeen(roomId, currentUser.id);
}

module.exports = {
  chatEligibleCoachIds,
  eligibleClientIdsForCoach,
  getOrCreateRoom,
  listMyRooms,
  listMessages,
  sendMessage,
  sendCoachAssignmentMessage,
  sendBookingMessage,
  markDelivered,
  markSeen,
  clearMessages,
  assertParticipant,
  toMessageDto
};
