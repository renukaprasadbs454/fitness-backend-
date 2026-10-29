const prisma = require("../database/prismaClient");
const ApiError = require("../utils/ApiError");
const adminRepository = require("../repositories/admin.repository");
const notificationService = require("./notification.service");
const { parsePagination, buildMeta } = require("../utils/pagination");

const userSelect = { id: true, fullName: true, email: true, role: true };

async function create(userId, { category, subject, message }) {
  return prisma.supportTicket.create({
    data: { userId, category, subject, message }
  });
}

async function findOwn(userId, id) {
  const ticket = await prisma.supportTicket.findFirst({ where: { id, userId } });
  if (!ticket) throw ApiError.notFound("Support request not found");
  return ticket;
}

// A request can be corrected only until support has picked it up (still OPEN, no reply yet).
async function updateMine(userId, id, { category, subject, message }) {
  const ticket = await findOwn(userId, id);
  if (ticket.status !== "OPEN" || ticket.adminReply) {
    throw ApiError.conflict("Support has already started on this request, so it can no longer be edited. Send a new request instead.");
  }
  return prisma.supportTicket.update({
    where: { id },
    data: { category: category ?? undefined, subject: subject ?? undefined, message: message ?? undefined }
  });
}

async function removeMine(userId, id) {
  throw ApiError.forbidden("Support requests cannot be deleted. You can edit your request while it is open.");
}

async function listMine(userId) {
  return prisma.supportTicket.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

async function adminList(query) {
  const { page, limit, skip } = parsePagination(query);
  const search = query.search?.trim();
  const where = {
    status: query.status || undefined,
    category: query.category || undefined,
    ...(search
      ? {
          OR: [
            { subject: { contains: search, mode: "insensitive" } },
            { message: { contains: search, mode: "insensitive" } },
            { user: { fullName: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {})
  };

  const [items, total, grouped] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: { user: { select: userSelect } },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: limit
    }),
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: true })
  ]);

  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  return { items, meta: { ...buildMeta(page, limit, total), counts } };
}

const STATUS_LABELS = { OPEN: "open", IN_PROGRESS: "in progress", RESOLVED: "resolved", CLOSED: "closed" };

async function adminRemove(adminId, id) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) throw ApiError.notFound("Support request not found");
  await prisma.supportTicket.delete({ where: { id } });
  await adminRepository.createAuditLog(adminId, "UPDATE_SUPPORT_TICKET", "SUPPORT_TICKET", id, { deleted: true, subject: ticket.subject });
}

async function adminUpdate(adminId, id, { status, adminReply, category, subject, message }) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) throw ApiError.notFound("Support request not found");

  const replyChanged = adminReply !== undefined && (adminReply || null) !== ticket.adminReply;
  const statusChanged = status !== undefined && status !== ticket.status;
  const closing = status === "RESOLVED" || status === "CLOSED";

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      status: status ?? undefined,
      category: category ?? undefined,
      subject: subject ?? undefined,
      message: message ?? undefined,
      resolvedAt: statusChanged ? (closing ? new Date() : null) : undefined,
      ...(replyChanged ? { adminReply: adminReply || null, repliedById: adminId, repliedAt: new Date() } : {})
    },
    include: { user: { select: userSelect } }
  });

  await adminRepository.createAuditLog(adminId, "UPDATE_SUPPORT_TICKET", "SUPPORT_TICKET", id, {
    status: statusChanged ? status : undefined,
    replied: replyChanged || undefined,
    edited: [category && "category", subject && "subject", message && "message"].filter(Boolean).join(",") || undefined
  });

  if (replyChanged || statusChanged) {
    const parts = [];
    if (replyChanged && adminReply) parts.push(`Support replied: "${adminReply.slice(0, 140)}"`);
    if (statusChanged) parts.push(`Your request is now ${STATUS_LABELS[status]}.`);
    await notificationService.notify(ticket.userId, "SYSTEM", `Support: ${ticket.subject}`.slice(0, 120), parts.join(" "), {
      data: { supportTicketId: id }
    });
  }

  return updated;
}

module.exports = { create, listMine, updateMine, removeMine, adminList, adminUpdate, adminRemove };
