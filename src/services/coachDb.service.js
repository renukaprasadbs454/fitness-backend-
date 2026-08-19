const prisma = require("../database/prismaClient");
const ApiError = require("../utils/ApiError");
const { getDatabaseSchema } = require("../utils/dbIntrospection");
const { resolveRelationLabels, getRelationOptions: getRelationOptionsFor } = require("../utils/dbRelationLabels");

// Account-management and revenue tables stay out of the coach's read-only
// explorer — User/Coach hold role + credential data (a coach editing their
// own row could self-promote), Payment is revenue data.
const HIDDEN_MODELS = ["User", "Coach", "Payment"];

// Fields that are themselves live credentials/session material, redacted
// even on the tables coaches ARE allowed to browse.
const REDACTED_FIELDS = {
  RefreshToken: ["token"],
  OtpCode: ["codeHash"],
  DeviceToken: ["token"]
};

const REDACTED_PLACEHOLDER = "••••••••";

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

function redact(modelInfo, rows) {
  const fieldsToRedact = REDACTED_FIELDS[modelInfo.name];
  if (!fieldsToRedact) return rows;

  return rows.map((row) => {
    const copy = { ...row };
    fieldsToRedact.forEach((field) => {
      if (field in copy) copy[field] = REDACTED_PLACEHOLDER;
    });
    return copy;
  });
}

function listTables() {
  return visibleModels();
}

async function getTableData(modelName, query = {}) {
  const modelInfo = findVisibleModel(modelName);
  const delegate = prisma[modelInfo.delegateName];

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
        skip,
        take: limit,
        select: selectObj,
        orderBy: { [scalarFields[0]?.name || "createdAt"]: "desc" }
      })
      .catch(() => delegate.findMany({ skip, take: limit, select: selectObj })),
    delegate.count().catch(() => 0)
  ]);

  const items = await resolveRelationLabels(prisma, modelInfo, rawItems);

  return {
    model: modelInfo,
    items: redact(modelInfo, items),
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

async function createModelRow(modelName, data) {
  const modelInfo = findVisibleModel(modelName);
  const delegate = prisma[modelInfo.delegateName];
  const cleanedData = sanitizeModelData(modelInfo, data);
  return delegate.create({ data: cleanedData });
}

async function updateModelRow(modelName, id, data) {
  const modelInfo = findVisibleModel(modelName);
  const delegate = prisma[modelInfo.delegateName];
  const idField = modelInfo.fields.find((f) => f.isId)?.name || "id";
  const cleanedData = sanitizeModelData(modelInfo, data);
  return delegate.update({ where: { [idField]: id }, data: cleanedData });
}

async function deleteModelRow(modelName, id) {
  const modelInfo = findVisibleModel(modelName);
  const delegate = prisma[modelInfo.delegateName];
  const idField = modelInfo.fields.find((f) => f.isId)?.name || "id";
  return delegate.delete({ where: { [idField]: id } });
}

// {id, label} options for a related model, to populate a foreign-key picker
// in the Insert/Edit Row form. Not gated by HIDDEN_MODELS: visible tables
// like Appointment/BmiLog have FKs into User/Coach, and this only ever
// returns an id + a short display label (name/email) — never the full row,
// so it doesn't reopen the credential/role exposure HIDDEN_MODELS guards
// against.
async function getRelationOptions(modelName) {
  return getRelationOptionsFor(prisma, modelName);
}

module.exports = { listTables, getTableData, createModelRow, updateModelRow, deleteModelRow, getRelationOptions };
