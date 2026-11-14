const crypto = require("node:crypto");
const prisma = require("../database/prismaClient");
const ApiError = require("../utils/ApiError");
const exportService = require("./userDataExport.service");

const REQUEST_TYPES = new Set(["ACCESS", "CORRECTION", "DELETION"]);
const REQUEST_STATUSES = new Set(["OPEN", "IN_REVIEW", "NEEDS_INFORMATION", "APPROVED", "REJECTED", "COMPLETED"]);
const GRIEVANCE_STATUSES = new Set(["OPEN", "IN_REVIEW", "NEEDS_INFORMATION", "RESOLVED", "CLOSED"]);

async function audit({ userId = null, actorId = null, action, subjectType, subjectId, metadata = {}, ip }) {
  await prisma.privacyAuditLog.create({ data: {
    userId, actorId, action, subjectType, subjectId, metadata,
    ipAddress: typeof ip === "string" ? ip.slice(0, 64) : null
  } });
}
function requiredText(value, label, max = 4000) {
  if (typeof value !== "string" || !value.trim()) throw ApiError.badRequest(`${label} is required.`);
  if (value.trim().length > max) throw ApiError.badRequest(`${label} must be ${max} characters or fewer.`);
  return value.trim();
}
function pageArgs(query = {}) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit, 10) || 25));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

async function getDashboard(userId) {
  const [notice, purposes, latest, consentHistory, requests, grievances, nominees] = await Promise.all([
    prisma.privacyNotice.findFirst({ where: { isCurrent: true }, orderBy: { effectiveAt: "desc" } }),
    prisma.privacyPurpose.findMany({ where: { enabled: true }, orderBy: [{ essential: "desc" }, { name: "asc" }] }),
    prisma.privacyConsentRecord.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { purpose: true, notice: { select: { version: true } } } }),
    prisma.privacyConsentRecord.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, include: { purpose: { select: { name: true } }, notice: { select: { version: true } } } }),
    prisma.privacyRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.privacyGrievance.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.privacyNominee.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, fullName: true, email: true, relationship: true, verifiedAt: true, createdAt: true } })
  ]);
  const current = {};
  for (const entry of latest) if (!(entry.purposeKey in current)) current[entry.purposeKey] = entry.granted;
  return { notice, purposes, currentConsents: current, consentHistory, requests, grievances, nominees };
}

async function recordConsent(userId, purposeKey, granted, requestMeta = {}) {
  if (typeof granted !== "boolean") throw ApiError.badRequest("Choose whether to allow this optional use of your data.");
  const [purpose, notice] = await Promise.all([
    prisma.privacyPurpose.findUnique({ where: { key: purposeKey } }),
    prisma.privacyNotice.findFirst({ where: { isCurrent: true }, orderBy: { effectiveAt: "desc" } })
  ]);
  if (!purpose || !purpose.enabled) throw ApiError.badRequest("That privacy purpose is not available.");
  if (purpose.essential) throw ApiError.badRequest("This processing is needed to provide the service and cannot be switched off here. You can request account deletion instead.");
  if (!notice) throw ApiError.internal("Privacy notice is not configured.");
  return prisma.$transaction(async (tx) => {
    const record = await tx.privacyConsentRecord.create({ data: {
      userId, purposeKey, noticeId: notice.id, granted, affirmative: true,
      collectionPoint: "privacy_dashboard", ipAddress: requestMeta.ip?.slice(0, 64) || null,
      userAgent: requestMeta.userAgent?.slice(0, 512) || null
    }, include: { purpose: true, notice: { select: { version: true } } } });
    if (!granted) {
      await tx.privacyConsentWithdrawal.create({ data: { userId, consentRecordId: record.id } });
      if (purposeKey === "notifications") {
        await tx.notificationPreference.upsert({
          where: { userId },
          update: { workoutReminders: false, appointmentReminders: false, coachMessages: false, announcements: false },
          create: { userId, workoutReminders: false, appointmentReminders: false, coachMessages: false, announcements: false }
        });
      }
    }
    await tx.privacyAuditLog.create({ data: {
      userId, actorId: userId, action: granted ? "CONSENT_GRANTED" : "CONSENT_WITHDRAWN",
      subjectType: "consent", subjectId: record.id,
      metadata: { purposeKey, noticeVersion: notice.version },
      ipAddress: typeof requestMeta.ip === "string" ? requestMeta.ip.slice(0, 64) : null
    } });
    return record;
  });
}

async function createRequest(userId, input, ip) {
  const type = String(input.type || "").toUpperCase();
  if (!REQUEST_TYPES.has(type)) throw ApiError.badRequest("Choose access, correction, or account deletion.");
  const subject = requiredText(input.subject, "Subject", 160);
  const details = requiredText(input.details, "Details", 4000);
  const activeDeletion = type === "DELETION" ? await prisma.privacyRequest.findFirst({ where: { userId, type, status: { notIn: ["REJECTED", "COMPLETED"] } } }) : null;
  if (activeDeletion) throw ApiError.conflict("You already have an account deletion request being reviewed.");
  const request = await prisma.privacyRequest.create({ data: {
    userId, type, subject, details,
    requestedFields: Array.isArray(input.requestedFields) ? input.requestedFields.filter((v) => typeof v === "string").slice(0, 50) : []
  } });
  await audit({ userId, actorId: userId, action: "PRIVACY_REQUEST_CREATED", subjectType: "request", subjectId: request.id, metadata: { type }, ip });
  return request;
}

async function createGrievance(userId, input, ip) {
  const subject = requiredText(input.subject, "Subject", 160);
  const message = requiredText(input.message, "Message", 4000);
  const grievance = await prisma.privacyGrievance.create({ data: {
    userId, reference: `PRV-${crypto.randomBytes(6).toString("hex").toUpperCase()}`, subject, message
  } });
  await audit({ userId, actorId: userId, action: "PRIVACY_GRIEVANCE_CREATED", subjectType: "grievance", subjectId: grievance.id, metadata: { reference: grievance.reference }, ip });
  return grievance;
}

async function addNominee(userId, input, ip) {
  const fullName = requiredText(input.fullName, "Nominee name", 120);
  const email = requiredText(input.email, "Nominee email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest("Enter a valid nominee email address.");
  const relationship = requiredText(input.relationship, "Relationship", 80);
  const count = await prisma.privacyNominee.count({ where: { userId, isActive: true } });
  if (count >= 5) throw ApiError.badRequest("You can add up to five nominees.");
  const nominee = await prisma.privacyNominee.create({ data: { userId, fullName, email, relationship } });
  await audit({ userId, actorId: userId, action: "NOMINEE_ADDED_UNVERIFIED", subjectType: "nominee", subjectId: nominee.id, ip });
  return { id: nominee.id, fullName, email, relationship, verifiedAt: null, createdAt: nominee.createdAt };
}

async function removeNominee(userId, id, ip) {
  const result = await prisma.privacyNominee.updateMany({ where: { id, userId, isActive: true }, data: { isActive: false } });
  if (!result.count) throw ApiError.notFound("Nominee not found.");
  await audit({ userId, actorId: userId, action: "NOMINEE_REMOVED", subjectType: "nominee", subjectId: id, ip });
}

async function exportOwnData(userId, format, ip) {
  const data = await exportService.buildUserDataExport(userId);
  // Only conversations in rooms where this user is the client are relevant; do not export a coach's unrelated client conversations.
  const rooms = await prisma.chatRoom.findMany({ where: { userId }, select: { id: true } });
  const roomIds = new Set(rooms.map((r) => r.id));
  data.records.chat_rooms = data.records.chat_rooms.filter((r) => roomIds.has(r.id));
  data.records.chat_messages = data.records.chat_messages.filter((m) => roomIds.has(m.roomId));
  // The general admin export can include coach-side records. A self-service
  // export must never disclose another member's details to a coach account.
  data.records.appointments = data.records.appointments.filter((r) => r.userId === userId);
  data.records.assigned_workout_plans = data.records.assigned_workout_plans.filter((r) => r.userId === userId);
  data.records.custom_workouts = data.records.custom_workouts.filter((r) => r.userId === userId);
  const customWorkoutIds = new Set(data.records.custom_workouts.map((r) => r.id));
  data.records.custom_workout_exercises = data.records.custom_workout_exercises.filter((r) => customWorkoutIds.has(r.customWorkoutId));
  const ownPlanIds = new Set([
    ...data.records.assigned_workout_plans.map((r) => r.planId),
    ...data.records.workout_completions.map((r) => r.planId),
    ...data.records.scheduled_workouts.map((r) => r.planId)
  ].filter(Boolean));
  data.records.workout_plans = data.records.workout_plans.filter((r) => ownPlanIds.has(r.id));
  data.records.workout_plan_exercises = data.records.workout_plan_exercises.filter((r) => ownPlanIds.has(r.planId));
  const ownExerciseIds = new Set(data.records.workout_plan_exercises.map((r) => r.exerciseId));
  data.records.exercises = data.records.exercises.filter((r) => ownExerciseIds.has(r.id));
  data.records.coach_reports = data.records.coach_reports.filter((r) => r.userId === userId);
  data.records.admin_audit_logs = data.records.admin_audit_logs.filter((r) => r.targetId === userId);
  data.recordCounts = Object.fromEntries(Object.entries(data.records).map(([key, rows]) => [key, rows.length]));
  await audit({ userId, actorId: userId, action: "PERSONAL_DATA_EXPORTED", subjectType: "user", subjectId: userId, metadata: { format }, ip });
  return format === "csv" ? exportService.buildUserDataCsv(data) : data;
}

async function adminOverview() {
  const [consents, pendingRequests, openGrievances, openIncidents, processors] = await Promise.all([
    prisma.privacyConsentRecord.groupBy({ by: ["purposeKey", "granted"], _count: { _all: true } }),
    prisma.privacyRequest.count({ where: { status: { in: ["OPEN", "IN_REVIEW", "NEEDS_INFORMATION"] } } }),
    prisma.privacyGrievance.count({ where: { status: { in: ["OPEN", "IN_REVIEW", "NEEDS_INFORMATION"] } } }),
    prisma.privacyBreachIncident.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.privacyProcessor.count({ where: { contractStatus: "REVIEW_REQUIRED" } })
  ]);
  return { consentCounts: consents.map((row) => ({ purposeKey: row.purposeKey, granted: row.granted, count: row._count._all })), pendingRequests, openGrievances, openIncidents, processorsNeedingReview: processors };
}

async function adminList(kind, query) {
  const { skip, take, page, limit } = pageArgs(query);
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 120) : "";
  if (kind === "requests") {
    const where = { ...(REQUEST_TYPES.has(query.type) ? { type: query.type } : {}), ...(REQUEST_STATUSES.has(query.status) ? { status: query.status } : {}), ...(search ? { OR: [{ subject: { contains: search, mode: "insensitive" } }, { details: { contains: search, mode: "insensitive" } }, { user: { fullName: { contains: search, mode: "insensitive" } } }, { user: { email: { contains: search, mode: "insensitive" } } }] } : {}) };
    const [items, total] = await Promise.all([prisma.privacyRequest.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, fullName: true, email: true } } } }), prisma.privacyRequest.count({ where })]);
    return { items, meta: { page, limit, total } };
  }
  if (kind === "grievances") {
    const where = { ...(GRIEVANCE_STATUSES.has(query.status) ? { status: query.status } : {}), ...(search ? { OR: [{ reference: { contains: search, mode: "insensitive" } }, { subject: { contains: search, mode: "insensitive" } }, { message: { contains: search, mode: "insensitive" } }, { user: { fullName: { contains: search, mode: "insensitive" } } }, { user: { email: { contains: search, mode: "insensitive" } } }] } : {}) };
    const [items, total] = await Promise.all([prisma.privacyGrievance.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, fullName: true, email: true } } } }), prisma.privacyGrievance.count({ where })]);
    return { items, meta: { page, limit, total } };
  }
  const where = search ? { OR: [{ action: { contains: search, mode: "insensitive" } }, { subjectType: { contains: search, mode: "insensitive" } }, { subjectId: { contains: search, mode: "insensitive" } }] } : {};
  const [items, total] = await Promise.all([prisma.privacyAuditLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }), prisma.privacyAuditLog.count({ where })]);
  return { items, meta: { page, limit, total } };
}

async function updateAdminRecord(kind, id, input, adminId, ip) {
  const status = String(input.status || "").toUpperCase();
  const response = input.response == null ? null : requiredText(input.response, "Response", 4000);
  if (kind === "requests") {
    if (!REQUEST_STATUSES.has(status)) throw ApiError.badRequest("Choose a valid request status.");
    if (status === "APPROVED") throw ApiError.badRequest("This screen cannot approve destructive work. Use the approved, verified operational process.");
    const existing = await prisma.privacyRequest.findUnique({ where: { id }, select: { type: true } });
    if (!existing) throw ApiError.notFound("Privacy request not found.");
    if (status === "COMPLETED" && (existing.type === "DELETION" || input.manualWorkCompleted !== true || !response)) {
      throw ApiError.badRequest("Deletion requests cannot be closed here. For access or correction, confirm the requested work is complete and add a response first.");
    }
    const item = await prisma.privacyRequest.update({ where: { id }, data: { status, response, handledById: adminId, handledAt: new Date() } });
    await audit({ userId: item.userId, actorId: adminId, action: "PRIVACY_REQUEST_STATUS_UPDATED", subjectType: "request", subjectId: id, metadata: { status }, ip });
    return item;
  }
  if (!GRIEVANCE_STATUSES.has(status)) throw ApiError.badRequest("Choose a valid grievance status.");
  const item = await prisma.privacyGrievance.update({ where: { id }, data: { status, response, handledById: adminId, handledAt: new Date() } });
  await audit({ userId: item.userId, actorId: adminId, action: "PRIVACY_GRIEVANCE_STATUS_UPDATED", subjectType: "grievance", subjectId: id, metadata: { status }, ip });
  return item;
}

module.exports = { getDashboard, recordConsent, createRequest, createGrievance, addNominee, removeNominee, exportOwnData, adminOverview, adminList, updateAdminRecord, audit, REQUEST_TYPES, REQUEST_STATUSES, GRIEVANCE_STATUSES };
