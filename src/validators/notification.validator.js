const { z } = require("zod");

const registerDevice = {
  body: z.object({
    token: z.string().min(10).max(500),
    platform: z.enum(["IOS", "ANDROID"])
  })
};

const unregisterDevice = {
  body: z.object({
    token: z.string().min(10).max(500)
  })
};

const listNotifications = {
  query: z.object({
    unreadOnly: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

const updatePreferences = {
  body: z.object({
    workoutReminders: z.boolean().optional(),
    appointmentReminders: z.boolean().optional(),
    coachMessages: z.boolean().optional(),
    announcements: z.boolean().optional()
  })
};

const idParam = { params: z.object({ id: z.string().uuid() }) };

module.exports = { registerDevice, unregisterDevice, listNotifications, updatePreferences, idParam };
