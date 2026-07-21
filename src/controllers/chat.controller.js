const chatService = require("../services/chat.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");
const ApiError = require("../utils/ApiError");

const openRoom = asyncHandler(async (req, res) => {
  const room = await chatService.getOrCreateRoom(req.user, req.body.participantId);
  return ApiResponse.success(res, httpStatus.OK, "Chat room ready", room);
});

const listRooms = asyncHandler(async (req, res) => {
  const rooms = await chatService.listMyRooms(req.user);
  return ApiResponse.success(res, httpStatus.OK, "Chat rooms retrieved", rooms);
});

const listMessages = asyncHandler(async (req, res) => {
  const { items, meta } = await chatService.listMessages(req.params.roomId, req.user, req.query);
  return ApiResponse.success(res, httpStatus.OK, "Messages retrieved", items, meta);
});

const sendMessage = asyncHandler(async (req, res) => {
  const { type = "TEXT", body } = req.body;
  if (type === "IMAGE" && !req.file) {
    throw ApiError.badRequest("Image file is required for IMAGE messages");
  }
  const result = await chatService.sendMessage(req.params.roomId, req.user, {
    type,
    body,
    imageBuffer: req.file?.buffer,
    imageMime: req.file?.mimetype,
    imageOriginalName: req.file?.originalname
  });

  // Notify the Socket.io gateway (if attached) so the recipient gets it
  // in real time even though this request came in over plain REST.
  req.app.get("chatSocketEmitter")?.(result.recipientId, result.message);

  return ApiResponse.success(res, httpStatus.CREATED, "Message sent", result.message);
});

const markSeen = asyncHandler(async (req, res) => {
  await chatService.markSeen(req.params.roomId, req.user);
  return ApiResponse.success(res, httpStatus.OK, "Messages marked as seen", null);
});

module.exports = { openRoom, listRooms, listMessages, sendMessage, markSeen };
