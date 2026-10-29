const prisma = require("../database/prismaClient");
const ApiError = require("../utils/ApiError");
const adminRepository = require("../repositories/admin.repository");
const notificationService = require("./notification.service");
const { parsePagination, buildMeta } = require("../utils/pagination");

const OPEN_STATUSES = ["OPEN", "REVIEWING"];

const REASON_LABELS = {
  UNRESPONSIVE: "Not responding",
  MISSED_SESSIONS: "Missed sessions",
  UNPROFESSIONAL: "Unprofessional",
  NOT_A_GOOD_FIT: "Not a good fit",
  INAPPROPRIATE_BEHAVIOUR: "Inappropriate behaviour",
  OTHER: "Other"
};

const adminInclude = {
  user: { select: { id: true, fullName: true, email: true, assignedCoachId: true } },
  coach: { select: { id: true, user: { select: { fullName: true, email: true } } } }
};

async function coachNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const coaches = await prisma.coach.findMany({
    where: { id: { in: unique } },
    select: { id: true, user: { select: { fullName: true } } }
  });
  return new Map(coaches.map((c) => [c.id, c.user.fullName]));
}

function toDto(report, names) {
  return {
    id: report.id,
    coachId: report.coachId,
    coachName: report.coach?.user?.fullName || null,
    coachEmail: report.coach?.user?.email,
    user: report.user,
    reason: report.reason,
    reasonLabel: REASON_LABELS[report.reason],
    details: report.details,
    wantsNewCoach: report.wantsNewCoach,
    status: report.status,
    adminNote: report.adminNote,
    reassignedToCoachId: report.reassignedToCoachId,
    reassignedToCoachName: report.reassignedToCoachId ? names.get(report.reassignedToCoachId) || null : null,
    resolvedAt: report.resolvedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}

async function create(userId, { coachId, reason, details, wantsNewCoach = false }) {
  const coach = await prisma.coach.findUnique({ where: { id: coachId }, select: { id: true, userId: true } });
  if (!coach) throw ApiError.notFound("Coach not found");
  if (coach.userId === userId) throw ApiError.badRequest("You can't report yourself");

  // Only a coach the user is assigned to, or has booked/completed a session with, can be reported.
  const [me, sessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { assignedCoachId: true } }),
    prisma.appointment.count({ where: { userId, coachId, status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] } } })
  ]);
  if (me?.assignedCoachId !== coachId && sessions === 0) {
    throw ApiError.forbidden("You can only report a coach you have booked a session with or been assigned to.");
  }

  const existing = await prisma.coachReport.findFirst({
    where: { userId, coachId, status: { in: OPEN_STATUSES } },
    select: { id: true }
  });
  if (existing) throw ApiError.conflict("You already have an open report about this coach. Our team is reviewing it.");

  const report = await prisma.coachReport.create({
    data: { userId, coachId, reason, details: details || null, wantsNewCoach },
    include: { coach: { select: { user: { select: { fullName: true } } } } }
  });
  return toDto(report, new Map());
}

async function listMine(userId) {
  const reports = await prisma.coachReport.findMany({
    where: { userId },
    include: { coach: { select: { user: { select: { fullName: true } } } } },
    orderBy: { createdAt: "desc" }
  });
  const names = await coachNames(reports.map((r) => r.reassignedToCoachId));
  return reports.map((r) => toDto(r, names));
}

async function adminList(query) {
  const { page, limit, skip } = parsePagination(query);
  const where = { status: query.status || undefined };
  const [reports, total, grouped] = await Promise.all([
    prisma.coachReport.findMany({ where, include: adminInclude, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.coachReport.count({ where }),
    prisma.coachReport.groupBy({ by: ["status"], _count: true })
  ]);
  const names = await coachNames(reports.map((r) => r.reassignedToCoachId));
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  return { items: reports.map((r) => toDto(r, names)), meta: { ...buildMeta(page, limit, total), counts } };
}

async function findOrFail(id) {
  const report = await prisma.coachReport.findUnique({ where: { id }, include: adminInclude });
  if (!report) throw ApiError.notFound("Report not found");
  return report;
}

const STATUS_MESSAGES = {
  REVIEWING: "Our team is reviewing your report.",
  RESOLVED: "Your report has been resolved.",
  DISMISSED: "Your report has been reviewed and closed."
};

async function adminUpdate(adminId, id, { status, adminNote }) {
  const report = await findOrFail(id);
  const closing = status && !OPEN_STATUSES.includes(status);

  const updated = await prisma.coachReport.update({
    where: { id },
    data: {
      status: status ?? undefined,
      adminNote: adminNote !== undefined ? adminNote || null : undefined,
      resolvedAt: status ? (closing ? new Date() : null) : undefined
    },
    include: adminInclude
  });

  await adminRepository.createAuditLog(adminId, "UPDATE_COACH_REPORT", "COACH_REPORT", id, { status, adminNote });

  if (status && status !== report.status && STATUS_MESSAGES[status]) {
    await notificationService.notify(
      report.userId,
      "SYSTEM",
      "Update on your coach report",
      [STATUS_MESSAGES[status], adminNote].filter(Boolean).join(" "),
      { data: { coachReportId: id } }
    );
  }

  const names = await coachNames([updated.reassignedToCoachId]);
  return toDto(updated, names);
}

/** Marks a report resolved after the admin moved the user to another coach (or removed the coach). */
async function markReassigned(adminId, id, newCoachId, adminNote) {
  const updated = await prisma.coachReport.update({
    where: { id },
    data: {
      status: "RESOLVED",
      reassignedToCoachId: newCoachId || null,
      adminNote: adminNote || undefined,
      resolvedAt: new Date()
    },
    include: adminInclude
  });
  await adminRepository.createAuditLog(adminId, "UPDATE_COACH_REPORT", "COACH_REPORT", id, {
    status: "RESOLVED",
    reassignedToCoachId: newCoachId || null
  });

  const names = await coachNames([newCoachId]);
  const newCoachName = names.get(newCoachId);
  await notificationService.notify(
    updated.userId,
    "SYSTEM",
    newCoachId ? "You have a new coach" : "Coach removed",
    newCoachId
      ? `After reviewing your report, we've moved you to ${newCoachName || "a new coach"}. They'll message you shortly.`
      : "After reviewing your report, we've removed your current coach. You can pick a new one from Coaches.",
    { data: { coachReportId: id } }
  );
  return toDto(updated, names);
}

module.exports = { create, listMine, adminList, adminUpdate, markReassigned, findOrFail };
