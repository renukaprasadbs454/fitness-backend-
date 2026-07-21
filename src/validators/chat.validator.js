const { z } = require("zod");

const openRoom = {
  body: z.object({
    participantId: z.string().uuid()
  })
};

const roomIdParam = {
  params: z.object({ roomId: z.string().uuid() })
};

const listMessages = {
  params: z.object({ roomId: z.string().uuid() }),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

const sendMessage = {
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({
    type: z.enum(["TEXT", "IMAGE"]).optional(),
    body: z.string().min(1).max(2000).optional()
  })
};

module.exports = { openRoom, roomIdParam, listMessages, sendMessage };
