const prisma = require("../database/prismaClient");
const ApiError = require("../utils/ApiError");
const { readFile } = require("../utils/storage");

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  // Prefix formula-like text so spreadsheet applications do not execute exported values.
  const safeText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

const CSV_SECTION_NAMES = {
  users: "Account details",
  user_profiles: "Fitness profile",
  coaches: "Coaches",
  coach_availability: "Coach availability",
  google_calendar_connections: "Calendar connection",
  refresh_tokens: "Sign-in sessions",
  otp_codes: "Email verification and sign-in codes",
  media: "Uploaded photos and files",
  bmi_logs: "BMI history",
  calorie_logs: "Calorie history",
  step_logs: "Step history",
  activity_logs: "Activity history",
  weight_logs: "Weight history",
  body_measurements: "Body measurements",
  workout_completions: "Completed workouts",
  scheduled_workouts: "Scheduled workouts",
  assigned_workout_plans: "Workout plans assigned to you",
  custom_workouts: "Custom workouts",
  custom_workout_exercises: "Exercises in custom workouts",
  workout_plans: "Workout plans",
  workout_plan_exercises: "Exercises in workout plans",
  exercises: "Exercise details",
  appointments: "Appointments",
  payments: "Payments",
  notifications: "Notifications",
  device_tokens: "Registered devices",
  admin_audit_logs: "Account support and admin history",
  chat_rooms: "Chat conversations",
  chat_messages: "Chat messages",
  notification_preferences: "Notification settings",
  content_posts: "Content you created",
  favorite_coaches: "Favorite coaches",
  coach_reports: "Coach reports",
  support_tickets: "Support requests"
};

const CSV_FIELD_NAMES = {
  id: "Reference number",
  userId: "Account reference",
  coachId: "Coach reference",
  planId: "Workout plan reference",
  exerciseId: "Exercise reference",
  fullName: "Full name",
  username: "Username",
  email: "Email address",
  phone: "Phone number",
  role: "Account type",
  isActive: "Account active",
  isEmailVerified: "Email verified",
  createdAt: "Created on",
  updatedAt: "Last updated",
  lastLoginAt: "Last sign-in",
  loggedAt: "Logged on",
  completedAt: "Completed on",
  scheduledAt: "Scheduled for",
  date: "Date",
  age: "Age",
  heightCm: "Height (cm)",
  weightKg: "Weight (kg)",
  fitnessGoals: "Fitness goals",
  goal: "Goal",
  gender: "Gender",
  title: "Title",
  body: "Message or description",
  description: "Description",
  type: "Type",
  status: "Status",
  isRead: "Read",
  used: "Used",
  attempts: "Attempts",
  expiresAt: "Expires on",
  revoked: "Session ended",
  createdByIp: "Sign-in IP address",
  profileImageUrl: "Profile photo link",
  imageUrl: "Photo or file link",
  storageKey: "Stored file reference",
  contentBase64: "Photo or file contents (encoded)",
  contentEncoding: "Photo or file format",
  assignedCoach: "Assigned coach",
  assignedCoachId: "Assigned coach reference",
  coach: "Coach details",
  profile: "Fitness profile details",
  messages: "Messages",
  exercises: "Exercises",
  category: "Category",
  user: "Account details",
  workout: "Workout details",
  paymentMethod: "Payment method",
  amount: "Amount",
  currency: "Currency",
  purpose: "Purpose",
  googleAccountId: "Google account",
  scope: "Calendar access requested",
  tokenType: "Connection type",
  platform: "Device type"
};

function humanizeField(field) {
  if (field.includes(".")) return field.split(".").map(humanizeField).join(" — ");
  return CSV_FIELD_NAMES[field] || field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatCsvValue(value, field) {
  if (value === null || value === undefined) return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? "Not provided"
      : `${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(value)} (India time)`;
  }
  if (Array.isArray(value)) return value.length ? value.map((item) => formatCsvValue(item, field)).join("; ") : "None";
  if (typeof value === "object") return "";

  let text = String(value);
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      const decoded = JSON.parse(text);
      if (typeof decoded === "string") text = decoded;
    } catch (_) { /* Keep the original text if it is not a JSON string. */ }
  }
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === "true" ? "Yes" : "No";
  if (/(At|Date|Until|On)$/.test(field) && /^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return `${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date)} (India time)`;
    }
  }
  if (field === "role") return text === "USER" ? "Member" : text.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const readable = text.replace(/_/g, " ");
  return /^[A-Z][A-Z\s]+$/.test(readable)
    ? readable.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
    : readable;
}

function appendReadableValue(rows, section, recordLabel, field, value) {
  if (value === null || value === undefined || typeof value !== "object" || value instanceof Date) {
    rows.push([section, recordLabel, humanizeField(field), formatCsvValue(value, field)]);
    return;
  }
  if (Array.isArray(value)) {
    if (!value.length) rows.push([section, recordLabel, humanizeField(field), "None"]);
    else value.forEach((item, index) => appendReadableValue(rows, section, recordLabel, `${field} ${index + 1}`, item));
    return;
  }
  const entries = Object.entries(value);
  if (!entries.length) rows.push([section, recordLabel, humanizeField(field), "None"]);
  else entries.forEach(([childField, childValue]) => appendReadableValue(rows, section, recordLabel, `${field}.${childField}`, childValue));
}

function buildUserDataCsv(data) {
  const rows = [["Section", "Record", "Information", "Details"]];
  rows.push(["About this file", "Export", "Created on", formatCsvValue(data.exportedAt, "exportedAt")]);
  rows.push(["About this file", "Export", "Account holder", data.subject.fullName || "Not provided"]);
  rows.push(["About this file", "Export", "Email address", data.subject.email || "Not provided"]);
  rows.push(["About this file", "Export", "Included information", "Account, fitness, sessions, workouts, health and activity history, payments, messages, notifications and related records"]);
  rows.push(["About this file", "Export", "Privacy note", "Passwords and private sign-in, verification, calendar and device tokens are not included"]);
  rows.push(["About this file", "Export", "Files not available", data.mediaWarnings.length ? `${data.mediaWarnings.length} uploaded file(s) could not be added; see Uploaded photos and files` : "None"]);

  for (const [recordType, records] of Object.entries(data.records)) {
    const section = CSV_SECTION_NAMES[recordType] || humanizeField(recordType);
    records.forEach((record, index) => {
      const recordName = record?.title || record?.fullName || record?.name || record?.email;
      const recordLabel = recordName ? `${section} — ${recordName}` : `${section} ${index + 1}`;
      for (const [field, value] of Object.entries(record || {})) {
        appendReadableValue(rows, section, recordLabel, field, value);
      }
    });
  }

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

const USER_SUMMARY_SELECT = {
  id: true,
  fullName: true,
  email: true,
  username: true,
  role: true
};

const planInclude = {
  exercises: {
    include: { exercise: true },
    orderBy: { sortOrder: "asc" }
  }
};

async function exportMediaFiles(userId, chatRooms) {
  const chatImageUrls = [...new Set(
    chatRooms.flatMap((room) => room.messages)
      .map((message) => message.imageUrl)
      .filter(Boolean)
  )];

  const media = await prisma.media.findMany({
    where: {
      OR: [
        { userId },
        ...(chatImageUrls.length ? [{ url: { in: chatImageUrls } }] : [])
      ]
    },
    orderBy: { createdAt: "asc" }
  });

  const warnings = [];
  const files = [];
  for (const item of media) {
    let contentBase64 = null;
    try {
      contentBase64 = (await readFile(item.storageKey)).toString("base64");
    } catch (error) {
      warnings.push({
        mediaId: item.id,
        message: "The media record is included, but its stored file could not be read."
      });
    }

    files.push({
      ...item,
      contentEncoding: contentBase64 ? "base64" : null,
      contentBase64
    });
  }

  return { files, warnings };
}

async function buildUserDataExport(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      coach: { include: { availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } } },
      assignedCoach: {
        include: {
          user: { select: USER_SUMMARY_SELECT },
          availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }
        }
      }
    }
  });
  if (!user) throw ApiError.notFound("User not found");

  const coachIds = [...new Set([user.coach?.id, user.assignedCoach?.id].filter(Boolean))];
  const [
    bmiLogs,
    calorieLogs,
    stepLogs,
    activityLogs,
    weightLogs,
    bodyMeasurements,
    workoutCompletions,
    scheduledWorkouts,
    customWorkouts,
    assignedWorkoutPlans,
    appointments,
    payments,
    notifications,
    deviceTokens,
    adminAuditLogs,
    chatRooms,
    notificationPreference,
    contentPosts,
    favoriteCoaches,
    coachReports,
    supportTickets,
    calendarConnection,
    refreshTokens,
    otpCodes,
    coachAvailability
  ] = await Promise.all([
    prisma.bmiLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.calorieLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.stepLog.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.activityLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedAt: "asc" } }),
    prisma.bodyMeasurement.findMany({ where: { userId }, orderBy: { loggedAt: "asc" } }),
    prisma.workoutCompletion.findMany({ where: { userId }, orderBy: { completedAt: "asc" } }),
    prisma.scheduledWorkout.findMany({ where: { userId }, orderBy: { scheduledAt: "asc" } }),
    prisma.customWorkout.findMany({
      where: { OR: [{ userId }, { assignedByUserId: userId }, { createdByUserId: userId }] },
      include: { exercises: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.assignedWorkoutPlan.findMany({
      where: { OR: [{ userId }, { assignedByUserId: userId }, { createdByUserId: userId }] },
      include: {
        user: { select: USER_SUMMARY_SELECT },
        assignedByUser: { select: USER_SUMMARY_SELECT },
        createdByUser: { select: USER_SUMMARY_SELECT }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.appointment.findMany({
      where: { OR: [{ userId }, { coach: { is: { userId } } }] },
      include: {
        user: { select: USER_SUMMARY_SELECT },
        coach: { include: { user: { select: USER_SUMMARY_SELECT } } }
      },
      orderBy: { scheduledAt: "asc" }
    }),
    prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.deviceToken.findMany({
      where: { userId },
      select: { id: true, platform: true, createdAt: true, updatedAt: true }
    }),
    prisma.adminAuditLog.findMany({
      where: { OR: [{ adminId: userId }, { targetType: "USER", targetId: userId }] },
      include: { admin: { select: USER_SUMMARY_SELECT } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.chatRoom.findMany({
      where: { OR: [{ userId }, { coach: { is: { userId } } }] },
      include: {
        user: { select: USER_SUMMARY_SELECT },
        coach: { include: { user: { select: USER_SUMMARY_SELECT } } },
        messages: {
          include: { sender: { select: USER_SUMMARY_SELECT } },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.notificationPreference.findUnique({ where: { userId } }),
    prisma.contentPost.findMany({
      where: { authorId: userId },
      include: { category: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.favoriteCoach.findMany({
      where: { userId },
      include: { coach: { include: { user: { select: USER_SUMMARY_SELECT } } } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.coachReport.findMany({
      where: { OR: [{ userId }, { coach: { is: { userId } } }] },
      include: {
        user: { select: USER_SUMMARY_SELECT },
        coach: { include: { user: { select: USER_SUMMARY_SELECT } } }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.supportTicket.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.googleCalendarConnection.findUnique({
      where: { userId },
      select: {
        id: true, userId: true, googleAccountId: true, expiresAt: true,
        scope: true, tokenType: true, createdAt: true, updatedAt: true
      }
    }),
    prisma.refreshToken.findMany({
      where: { userId },
      select: { id: true, userId: true, expiresAt: true, revoked: true, createdByIp: true, createdAt: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.otpCode.findMany({
      where: { userId },
      select: { id: true, userId: true, purpose: true, expiresAt: true, used: true, attempts: true, createdAt: true },
      orderBy: { createdAt: "asc" }
    }),
    coachIds.length
      ? prisma.coachAvailability.findMany({
          where: { coachId: { in: coachIds } },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
        })
      : Promise.resolve([])
  ]);

  const referencedPlanIds = [...new Set([
    ...workoutCompletions.map((row) => row.planId),
    ...scheduledWorkouts.map((row) => row.planId),
    ...assignedWorkoutPlans.map((row) => row.planId)
  ])];
  const workoutPlans = referencedPlanIds.length
    ? await prisma.workoutPlan.findMany({ where: { id: { in: referencedPlanIds } }, include: planInclude })
    : [];

  const planExercises = workoutPlans.flatMap((plan) => plan.exercises);
  const exercisesById = new Map(planExercises.map((entry) => [entry.exercise.id, entry.exercise]));
  const { passwordHash, ...safeUser } = user;
  const { files: mediaFiles, warnings: mediaWarnings } = await exportMediaFiles(userId, chatRooms);

  const records = {
    users: [safeUser],
    user_profiles: user.profile ? [user.profile] : [],
    coaches: [user.coach, user.assignedCoach].filter(Boolean),
    coach_availability: coachAvailability,
    google_calendar_connections: calendarConnection ? [calendarConnection] : [],
    refresh_tokens: refreshTokens,
    otp_codes: otpCodes,
    media: mediaFiles,
    bmi_logs: bmiLogs,
    calorie_logs: calorieLogs,
    step_logs: stepLogs,
    activity_logs: activityLogs,
    weight_logs: weightLogs,
    body_measurements: bodyMeasurements,
    workout_completions: workoutCompletions,
    scheduled_workouts: scheduledWorkouts,
    assigned_workout_plans: assignedWorkoutPlans,
    custom_workouts: customWorkouts,
    custom_workout_exercises: customWorkouts.flatMap((workout) => workout.exercises),
    workout_plans: workoutPlans,
    workout_plan_exercises: planExercises,
    exercises: [...exercisesById.values()],
    appointments,
    payments,
    notifications,
    device_tokens: deviceTokens,
    admin_audit_logs: adminAuditLogs,
    chat_rooms: chatRooms.map(({ messages, ...room }) => room),
    chat_messages: chatRooms.flatMap((room) => room.messages),
    notification_preferences: notificationPreference ? [notificationPreference] : [],
    content_posts: contentPosts,
    favorite_coaches: favoriteCoaches,
    coach_reports: coachReports,
    support_tickets: supportTickets
  };

  return {
    exportFormat: "FitNerve user data export",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    subject: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    recordCounts: Object.fromEntries(Object.entries(records).map(([table, rows]) => [table, rows.length])),
    mediaWarnings,
    excludedSensitiveFields: [
      "Password hashes, refresh-token values, OTP code hashes, Google access/refresh tokens, and device push-token values are excluded. Their non-secret account or session metadata is included where applicable."
    ],
    records
  };
}

module.exports = { buildUserDataExport, buildUserDataCsv };
