const prisma = require("../database/prismaClient");
const ApiError = require("../utils/ApiError");
const coachRepository = require("../repositories/coach.repository");
const userRepository = require("../repositories/user.repository");
const { getDatabaseSchema } = require("../utils/dbIntrospection");
const { resolveRelationLabels, getRelationOptions: getRelationOptionsFor } = require("../utils/dbRelationLabels");

// Account-management, revenue and credential/session tables are not exposed to
// coaches at all. User/Coach hold role + credential data (a coach editing their
// own row could self-promote), Payment is revenue data, and the rest are live
// login/reset/session material — a coach able to write an OtpCode or
// RefreshToken row could take over any account.
const HIDDEN_MODELS = [
  "User",
  "Coach",
  "Payment",
  "RefreshToken",
  "OtpCode",
  "DeviceToken",
  "GoogleCalendarConnection",
  "AdminAuditLog"
];

// A coach only sees rows that belong to their own assigned users (or to their
// own coaching relationship). Models whose ownership isn't a plain `userId`
// column are scoped through their relation here; any other model with a
// `userId` column is scoped to the coach's assigned users; models with neither
// (workout plans, exercises, content) are shared reference data and stay open.
const RELATIONAL_SCOPES = {
  Appointment: ({ coachId }) => ({ coachId }),
  ChatRoom: ({ coachId }) => ({ coachId }),
  CoachAvailability: ({ coachId }) => ({ coachId }),
  ChatMessage: ({ coachId }) => ({ room: { coachId } }),
  CustomWorkoutExercise: ({ clientIds }) => ({ customWorkout: { userId: { in: clientIds } } })
};

// Rows that can't be safely created generically because their ownership lives
// on a parent record the caller would have to name.
const NO_GENERIC_CREATE = ["ChatMessage", "CustomWorkoutExercise"];

// Ownership columns a coach may not rewrite on an existing row (that would let
// them hand a row to, or take one from, someone outside their scope).
const PROTECTED_UPDATE_FIELDS = ["id", "userId", "coachId"];

async function getCoachContext(coachUserId) {
  const coach = await coachRepository.findByUserId(coachUserId);
  if (!coach) throw ApiError.forbidden("Coach profile not found for this account");
  const clientIds = await userRepository.listClientIdsOfCoach(coach.id);
  return { coachId: coach.id, clientIds };
}

function hasField(modelInfo, name) {
  return modelInfo.fields.some((f) => f.name === name);
}

/** Prisma `where` limiting a model to this coach's rows, or null for shared reference data. */
function scopeFor(modelInfo, ctx) {
  const relational = RELATIONAL_SCOPES[modelInfo.name];
  if (relational) return relational(ctx);
  if (hasField(modelInfo, "userId")) return { userId: { in: ctx.clientIds } };
  return null;
}

function idFieldOf(modelInfo) {
  return modelInfo.fields.find((f) => f.isId)?.name || "id";
}

function visibleModels() {
  return getDatabaseSchema().filter((m) => !HIDDEN_MODELS.includes(m.name));
}

function findVisibleModel(modelName) {
  const model = visibleModels().find(
    (m) =>
      m.name.toLowerCase() === modelName.toLowerCase() ||
      m.delegateName.toLowerCase() === modelName.toLowerCase() ||
      m.tableName.toLowerCase() === modelName.toLowerCase()
  );
  if (!model) throw ApiError.notFound(`Table '${modelName}' not found`);
  return model;
}

/** Finds one row by id inside the coach's scope, or 404s — never reveals out-of-scope rows. */
async function findScopedRow(modelInfo, delegate, id, ctx) {
  const scope = scopeFor(modelInfo, ctx);
  const row = await delegate.findFirst({
    where: scope ? { AND: [{ [idFieldOf(modelInfo)]: id }, scope] } : { [idFieldOf(modelInfo)]: id },
    select: { [idFieldOf(modelInfo)]: true }
  });
  if (!row) throw ApiError.notFound("Record not found");
}

function listTables() {
  return visibleModels();
}

async function getTableData(coachUserId, modelName, query = {}) {
  const ctx = await getCoachContext(coachUserId);
  const modelInfo = findVisibleModel(modelName);
  const delegate = prisma[modelInfo.delegateName];
  const where = scopeFor(modelInfo, ctx) || undefined;

  const limit = Math.min(Number(query.limit) || 50, 200);
  const page = Math.max(Number(query.page) || 1, 1);
  const skip = (page - 1) * limit;

  const scalarFields = modelInfo.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
  const selectObj = {};
  scalarFields.forEach((f) => {
    selectObj[f.name] = true;
  });

  const [rawItems, total] = await Promise.all([
    delegate
      .findMany({
        where,
        skip,
        take: limit,
        select: selectObj,
        orderBy: { [scalarFields[0]?.name || "createdAt"]: "desc" }
      })
      .catch(() => delegate.findMany({ where, skip, take: limit, select: selectObj })),
    delegate.count({ where }).catch(() => 0)
  ]);

  const items = await resolveRelationLabels(prisma, modelInfo, rawItems);

  return {
    model: modelInfo,
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

function sanitizeModelData(modelInfo, data) {
  const sanitized = { ...data };
  if (modelInfo && modelInfo.fields) {
    modelInfo.fields.forEach((f) => {
      if (f.type === "DateTime" && f.name in sanitized) {
        const val = sanitized[f.name];
        if (val === "" || val === null || val === undefined) {
          if (!f.isRequired) {
            sanitized[f.name] = null;
          } else {
            delete sanitized[f.name];
          }
        } else if (typeof val === "string") {
          const parsed = new Date(val);
          if (!isNaN(parsed.getTime())) {
            sanitized[f.name] = parsed.toISOString();
          } else if (!f.isRequired) {
            sanitized[f.name] = null;
          } else {
            delete sanitized[f.name];
          }
        }
      }
    });
  }
  return sanitized;
}

async function createModelRow(coachUserId, modelName, data) {
  const ctx = await getCoachContext(coachUserId);
  const modelInfo = findVisibleModel(modelName);
  if (NO_GENERIC_CREATE.includes(modelInfo.name)) {
    throw ApiError.forbidden(`Rows can't be created directly in '${modelInfo.name}'`);
  }

  const cleanedData = sanitizeModelData(modelInfo, data);

  // A new row can only be attached to one of the coach's own assigned users...
  if (hasField(modelInfo, "userId") && !ctx.clientIds.includes(cleanedData.userId)) {
    throw ApiError.forbidden("You can only add records for users assigned to you");
  }
  // ...and to the coach themselves, never someone else's coaching relationship.
  if (hasField(modelInfo, "coachId")) {
    cleanedData.coachId = ctx.coachId;
  }

  return prisma[modelInfo.delegateName].create({ data: cleanedData });
}

async function updateModelRow(coachUserId, modelName, id, data) {
  const ctx = await getCoachContext(coachUserId);
  const modelInfo = findVisibleModel(modelName);
  const delegate = prisma[modelInfo.delegateName];
  await findScopedRow(modelInfo, delegate, id, ctx);

  const cleanedData = sanitizeModelData(modelInfo, data);
  PROTECTED_UPDATE_FIELDS.forEach((field) => delete cleanedData[field]);

  return delegate.update({ where: { [idFieldOf(modelInfo)]: id }, data: cleanedData });
}

async function deleteModelRow(coachUserId, modelName, id) {
  const ctx = await getCoachContext(coachUserId);
  const modelInfo = findVisibleModel(modelName);
  const delegate = prisma[modelInfo.delegateName];
  await findScopedRow(modelInfo, delegate, id, ctx);

  return delegate.delete({ where: { [idFieldOf(modelInfo)]: id } });
}

// {id, label} options for a related model, to populate a foreign-key picker
// in the Insert/Edit Row form. Not gated by HIDDEN_MODELS (visible tables like
// Appointment/BmiLog have FKs into User/Coach), but narrowed to what this coach
// may actually reference: only their own assigned users, only themselves, only
// their own rooms. Only ever returns an id + short label, never the full row.
async function getRelationOptions(coachUserId, modelName) {
  const ctx = await getCoachContext(coachUserId);
  const where = {
    User: { assignedCoachId: ctx.coachId },
    Coach: { id: ctx.coachId },
    ChatRoom: { coachId: ctx.coachId },
    CustomWorkout: { userId: { in: ctx.clientIds } }
  }[modelName];

  return getRelationOptionsFor(prisma, modelName, where);
}

module.exports = { listTables, getTableData, createModelRow, updateModelRow, deleteModelRow, getRelationOptions };
