const router = require("express").Router();
const chatController = require("../../controllers/chat.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const upload = require("../../middlewares/upload.middleware");
const schemas = require("../../validators/chat.validator");

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Real-time user <-> coach messaging. REST endpoints here mirror the Socket.io "/chat" namespace for history and as a fallback transport.
 */

/**
 * @swagger
 * /chat/rooms:
 *   get:
 *     summary: List the current user's chat rooms (most recent first)
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: scope, schema: { type: string, enum: [mine, all] }, description: "Head coach only: all = every coach's conversations" }
 *     responses:
 *       200: { description: Chat rooms retrieved }
 */
router.get("/rooms", authenticate, validate(schemas.listRooms), chatController.listRooms);

/**
 * @swagger
 * /chat/rooms:
 *   post:
 *     summary: Open (or lazily create) a chat room with a user/coach counterpart
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participantId]
 *             properties:
 *               participantId:
 *                 type: string
 *                 description: Coach id (if caller is a USER) or User id (if caller is a COACH)
 *               coachId:
 *                 type: string
 *                 format: uuid
 *                 description: Head coach only - open the conversation for this coach instead of yourself
 *     responses:
 *       200: { description: Chat room ready }
 */
router.post("/rooms", authenticate, validate(schemas.openRoom), chatController.openRoom);

/**
 * @swagger
 * /chat/rooms/{roomId}/messages:
 *   get:
 *     summary: Get message history for a room (paginated, newest page first, oldest-to-newest within the page)
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Messages retrieved }
 *       403: { description: Not a participant in this room }
 */
router.get(
  "/rooms/:roomId/messages",
  authenticate,
  validate(schemas.listMessages),
  chatController.listMessages
);

/**
 * @swagger
 * /chat/rooms/{roomId}/messages:
 *   post:
 *     summary: Send a text or image message (REST fallback; prefer the Socket.io "message" event for real-time delivery)
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [TEXT, IMAGE] }
 *               body: { type: string }
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: Message sent }
 */
router.post(
  "/rooms/:roomId/messages",
  authenticate,
  upload.single("file"),
  validate(schemas.sendMessage),
  chatController.sendMessage
);

/**
 * @swagger
 * /chat/rooms/{roomId}/messages:
 *   delete:
 *     summary: Clear this room's chat history on the caller's side only (does not delete anything for the other participant)
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Chat cleared }
 *       403: { description: Not a participant in this room }
 */
router.delete(
  "/rooms/:roomId/messages",
  authenticate,
  validate(schemas.roomIdParam),
  chatController.clearMessages
);

/**
 * @swagger
 * /chat/rooms/{roomId}/seen:
 *   patch:
 *     summary: Mark all of the counterpart's messages in this room as seen
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Messages marked as seen }
 */
router.patch(
  "/rooms/:roomId/seen",
  authenticate,
  validate(schemas.roomIdParam),
  chatController.markSeen
);

module.exports = router;
