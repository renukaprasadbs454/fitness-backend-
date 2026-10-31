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
    type: z.enum(["WORKOUT_REMINDER", "WORKOUT_ASSIGNED", "APPOINTMENT_REMINDER", "APPOINTMENT_CHANGED", "COACH_MESSAGE", "ANNOUNCEMENT", "SYSTEM"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

const unreadCount = {
  query: z.object({
    type: z.enum(["WORKOUT_REMINDER", "WORKOUT_ASSIGNED", "APPOINTMENT_REMINDER", "APPOINTMENT_CHANGED", "COACH_MESSAGE", "ANNOUNCEMENT", "SYSTEM"]).optional()
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
const typeParam = { params: z.object({ type: z.enum(["WORKOUT_REMINDER", "WORKOUT_ASSIGNED", "APPOINTMENT_REMINDER", "APPOINTMENT_CHANGED", "COACH_MESSAGE", "ANNOUNCEMENT", "SYSTEM"]) }) };

module.exports = { registerDevice, unregisterDevice, listNotifications, unreadCount, updatePreferences, idParam, typeParam };
