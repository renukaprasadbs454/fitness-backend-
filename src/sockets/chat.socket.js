const { verifyAccessToken } = require("../utils/jwt");
const prisma = require("../database/prismaClient");
const chatService = require("../services/chat.service");
const logger = require("../config/logger");

// Simple sliding-window rate limit for message:send, since Express's
// HTTP rate limiter middleware never sees Socket.io traffic. Keyed per
// userId; resets after WINDOW_MS. Generous enough for real conversation,
// tight enough to stop a scripted flood.
const MAX_MESSAGES_PER_WINDOW = 30;
const WINDOW_MS = 60 * 1000;
const messageRateState = new Map(); // userId -> { count, windowStart }

// Keep the Socket.IO handshake session rules aligned with HTTP authentication.
// In particular, tokens tied to a refresh-token row must stop working as soon
// as logout, password reset, or admin revocation marks that row revoked.
function createSocketAuthenticator({ verifyToken = verifyAccessToken, findUser, findSession, now = () => new Date() }) {
  return async function authenticateSocketToken(token) {
    if (!token) throw new Error("Missing auth token");
    const payload = verifyToken(token);
    let user;
    if (payload.sid) {
      const session = await findSession(payload.sid);
      if (!session || session.userId !== payload.sub || session.revoked || session.expiresAt <= now()) {
        throw new Error("Session has ended");
      }
      user = session.user;
    } else {
      // Short-lived pre-session tokens remain accepted until their expiry,
      // matching the HTTP migration compatibility behavior.
      user = await findUser(payload.sub);
    }
    if (!user || !user.isActive) throw new Error("User is inactive");
    return { id: user.id, role: user.role };
  };
}

const authenticateSocketToken = createSocketAuthenticator({
  findUser: (id) => prisma.user.findUnique({ where: { id } }),
  findSession: (id) => prisma.refreshToken.findUnique({ where: { id }, include: { user: true } })
});

function isRateLimited(userId) {
  const now = Date.now();
  const state = messageRateState.get(userId);
  if (!state || now - state.windowStart > WINDOW_MS) {
    messageRateState.set(userId, { count: 1, windowStart: now });
    return false;
  }
  state.count += 1;
  return state.count > MAX_MESSAGES_PER_WINDOW;
}

/**
 * Tracks which userIds currently have at least one open socket, so we can
 * broadcast online/offline presence without hitting the database.
 * Multiple tabs/devices per user are supported via a ref-count per userId.
 */
const onlineCounts = new Map();

function markOnline(io, userId) {
  const next = (onlineCounts.get(userId) || 0) + 1;
  onlineCounts.set(userId, next);
  if (next === 1) io.of("/chat").emit("presence:update", { userId, online: true });
}

function markOffline(io, userId) {
  const next = (onlineCounts.get(userId) || 1) - 1;
  if (next <= 0) {
    onlineCounts.delete(userId);
    io.of("/chat").emit("presence:update", { userId, online: false });
  } else {
    onlineCounts.set(userId, next);
  }
}

/**
 * Attaches the /chat Socket.io namespace to an existing HTTP server's
 * Socket.io instance. Each authenticated user joins a personal room
 * (`user:<id>`) so the server can push events to them from anywhere
 * (including the REST fallback controller) without tracking raw socket ids.
 */
function registerChatGateway(io) {
  const chatNsp = io.of("/chat");

  chatNsp.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
      socket.user = await authenticateSocketToken(token);
      next();
    } catch (err) {
      next(new Error("Invalid or expired token"));
    }
  });

  chatNsp.on("connection", (socket) => {
    const { id: userId } = socket.user;
    socket.join(`user:${userId}`);
    markOnline(io, userId);

    socket.on("room:join", async ({ roomId }, ack) => {
      try {
        await chatService.assertParticipant(roomId, socket.user);
        socket.join(`room:${roomId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on("room:leave", ({ roomId }) => {
      socket.leave(`room:${roomId}`);
    });

    socket.on("typing", async ({ roomId, isTyping }) => {
      try {
        const access = await chatService.assertParticipant(roomId, socket.user);
        if (access.canSend) socket.to(`room:${roomId}`).emit("typing", { roomId, userId, isTyping: !!isTyping });
      } catch (err) {
        logger.warn(`[chat] typing event rejected: ${err.message}`);
      }
    });

    socket.on("message:send", async (payload, ack) => {
      try {
        if (isRateLimited(userId)) {
          ack?.({ ok: false, error: "You're sending messages too quickly. Please slow down." });
          return;
        }
        const { roomId, type = "TEXT", body } = payload || {};
        const result = await chatService.sendMessage(roomId, socket.user, { type, body });

        chatNsp.to(`room:${roomId}`).emit("message:new", result.message);
        chatNsp.to(`user:${result.recipientId}`).emit("message:new", result.message);
        ack?.({ ok: true, message: result.message });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on("message:delivered", async ({ roomId }) => {
      try {
        await chatService.markDelivered(roomId, socket.user);
        chatNsp.to(`room:${roomId}`).emit("message:status", { roomId, status: "DELIVERED" });
      } catch (err) {
        logger.warn(`[chat] delivered ack failed: ${err.message}`);
      }
    });

    socket.on("message:seen", async ({ roomId }) => {
      try {
        await chatService.markSeen(roomId, socket.user);
        chatNsp.to(`room:${roomId}`).emit("message:status", { roomId, status: "SEEN", by: userId });
      } catch (err) {
        logger.warn(`[chat] seen ack failed: ${err.message}`);
      }
    });

    socket.on("disconnect", () => {
      markOffline(io, userId);
      messageRateState.delete(userId);
    });
  });

  // Lets REST controllers (e.g. image uploads and coach web chat) deliver the
  // same event as Socket.IO sends. The room covers an open conversation while
  // the personal room updates badges on every other device/tab.
  return (roomId, recipientUserId, message) => {
    chatNsp.to(`room:${roomId}`).emit("message:new", message);
    chatNsp.to(`user:${recipientUserId}`).emit("message:new", message);
  };
}

module.exports = { registerChatGateway, createSocketAuthenticator };
