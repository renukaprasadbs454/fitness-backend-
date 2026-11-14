const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const privacy = require("../services/privacy.service");
const prisma = require("../database/prismaClient");
const ApiError = require("../utils/ApiError");

const publicNotice = asyncHandler(async (_req, res) => {
  const notice = await prisma.privacyNotice.findFirst({ where: { isCurrent: true }, orderBy: { effectiveAt: "desc" }, select: { version: true, title: true, body: true, policyUrl: true, termsVersion: true, termsTitle: true, termsBody: true, effectiveAt: true } });
  if (!notice) throw ApiError.internal("Privacy documents are not configured by the administrator yet.");
  return ApiResponse.success(res, 200, "Current legal documents retrieved", notice);
});

const adminLegalDocuments = asyncHandler(async (req, res) => {
  if (req.method === "GET") {
    const current = await prisma.privacyNotice.findFirst({ where: { isCurrent: true }, orderBy: { effectiveAt: "desc" }, select: { version: true, title: true, body: true, policyUrl: true, termsVersion: true, termsTitle: true, termsBody: true, effectiveAt: true } });
    return ApiResponse.success(res, 200, "Current legal documents retrieved", current);
  }
  const privacyPolicy = req.body.privacyPolicy || {};
  const terms = req.body.terms || {};
  const requiredText = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
  if (!requiredText(privacyPolicy.version, 40) || !requiredText(privacyPolicy.title, 160) || !requiredText(privacyPolicy.body, 60000)) throw ApiError.badRequest("Enter a version, title, and Privacy Policy content (up to 60,000 characters).");
  if (!requiredText(terms.version, 40) || !requiredText(terms.title, 160) || !requiredText(terms.body, 60000)) throw ApiError.badRequest("Enter a version, title, and Terms and Conditions content (up to 60,000 characters).");
  const versionInUse = await prisma.privacyNotice.findFirst({ where: { OR: [{ version: privacyPolicy.version.trim() }, { termsVersion: terms.version.trim() }] }, select: { id: true } });
  if (versionInUse) throw ApiError.conflict("That document version has already been published. Use a new version number for both documents.");
  const published = await prisma.$transaction(async (tx) => {
    await tx.privacyNotice.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    return tx.privacyNotice.create({ data: {
      version: privacyPolicy.version.trim(), title: privacyPolicy.title.trim(), body: privacyPolicy.body.trim(),
      policyUrl: typeof privacyPolicy.policyUrl === "string" && privacyPolicy.policyUrl.trim() ? privacyPolicy.policyUrl.trim().slice(0, 1000) : null,
      termsVersion: terms.version.trim(), termsTitle: terms.title.trim(), termsBody: terms.body.trim(),
      isCurrent: true, effectiveAt: new Date()
    }, select: { version: true, title: true, body: true, policyUrl: true, termsVersion: true, termsTitle: true, termsBody: true, effectiveAt: true } });
  });
  await privacy.audit({ actorId: req.user.id, action: "LEGAL_DOCUMENTS_PUBLISHED", subjectType: "privacy_notice", subjectId: published.version, metadata: { privacyPolicyVersion: published.version, termsVersion: published.termsVersion }, ip: req.ip });
  return ApiResponse.success(res, 201, "Legal documents published. New registrations must accept these versions.", published);
});

const dashboard = asyncHandler(async (req, res) => ApiResponse.success(res, 200, "Privacy information retrieved", await privacy.getDashboard(req.user.id)));
const setConsent = asyncHandler(async (req, res) => ApiResponse.success(res, 201, "Your choice has been saved", await privacy.recordConsent(req.user.id, req.params.purposeKey, req.body.granted, { ip: req.ip, userAgent: req.get("user-agent") })));
const createRequest = asyncHandler(async (req, res) => ApiResponse.success(res, 201, "Your privacy request was submitted", await privacy.createRequest(req.user.id, req.body, req.ip)));
const createGrievance = asyncHandler(async (req, res) => ApiResponse.success(res, 201, "Your privacy concern was submitted", await privacy.createGrievance(req.user.id, req.body, req.ip)));
const addNominee = asyncHandler(async (req, res) => ApiResponse.success(res, 201, "Nominee added. Their identity is not yet verified", await privacy.addNominee(req.user.id, req.body, req.ip)));
const removeNominee = asyncHandler(async (req, res) => { await privacy.removeNominee(req.user.id, req.params.id, req.ip); return ApiResponse.success(res, 200, "Nominee removed", null); });
const exportData = asyncHandler(async (req, res) => {
  const format = String(req.query.format || "json").toLowerCase();
  if (!new Set(["json", "csv"]).has(format)) throw ApiError.badRequest("Choose JSON or CSV format.");
  const result = await privacy.exportOwnData(req.user.id, format, req.ip);
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="fitnerve-my-data.csv"');
    return res.send(result);
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="fitnerve-my-data.json"');
  return res.send(JSON.stringify(result, null, 2));
});
const adminList = (kind) => asyncHandler(async (req, res) => { const result = await privacy.adminList(kind, req.query); return ApiResponse.success(res, 200, "Privacy records retrieved", result.items, result.meta); });
const adminUpdate = (kind) => asyncHandler(async (req, res) => ApiResponse.success(res, 200, "Privacy record updated", await privacy.updateAdminRecord(kind, req.params.id, req.body, req.user.id, req.ip)));
const adminOverview = asyncHandler(async (_req, res) => ApiResponse.success(res, 200, "Privacy overview retrieved", await privacy.adminOverview()));

const processors = asyncHandler(async (req, res) => {
  if (req.method === "GET") return ApiResponse.success(res, 200, "Processor register retrieved", await prisma.privacyProcessor.findMany({ orderBy: { name: "asc" } }));
  const body = req.body;
  const name = String(body.name || "").trim();
  const service = String(body.service || "").trim();
  if (!name || !service) throw ApiError.badRequest("Provider name and service description are required.");
  if (name.length > 120 || service.length > 1000) throw ApiError.badRequest("Provider name or service description is too long.");
  for (const key of ["purposes", "dataCategories", "storageLocations"]) if (body[key] !== undefined && (!Array.isArray(body[key]) || body[key].length > 50 || body[key].some((v) => typeof v !== "string" || v.length > 200))) throw ApiError.badRequest(`${key} must be a list of up to 50 short text values.`);
  const allowedContractStatuses = new Set(["REVIEW_REQUIRED", "REVIEWED", "CONTRACTED", "NOT_APPLICABLE"]);
  const contractStatus = String(body.contractStatus || (body.reviewed === true ? "REVIEWED" : "REVIEW_REQUIRED")).toUpperCase();
  if (!allowedContractStatuses.has(contractStatus)) throw ApiError.badRequest("Choose a valid provider review status.");
  for (const key of ["safeguards", "retentionAndDelete"]) if (body[key] != null && (typeof body[key] !== "string" || body[key].length > 8000)) throw ApiError.badRequest(`${key} must be text under 8,000 characters.`);
  const changes = { service, purposes: body.purposes || [], dataCategories: body.dataCategories || [], storageLocations: body.storageLocations || [], safeguards: body.safeguards || null, retentionAndDelete: body.retentionAndDelete || null, contractStatus, updatedById: req.user.id };
  const record = await prisma.privacyProcessor.upsert({ where: { name }, create: { name, ...changes }, update: { ...changes, lastReviewedAt: body.reviewed === true ? new Date() : undefined } });
  await privacy.audit({ actorId: req.user.id, action: "PROCESSOR_REGISTER_UPDATED", subjectType: "processor", subjectId: record.id, metadata: { name }, ip: req.ip });
  return ApiResponse.success(res, 200, "Processor register saved", record);
});

const retentionPolicies = asyncHandler(async (req, res) => {
  if (req.method === "GET") return ApiResponse.success(res, 200, "Retention policies retrieved", await prisma.privacyRetentionPolicy.findMany({ orderBy: { category: "asc" } }));
  const category = String(req.body.category || "");
  const periodDays = req.body.periodDays == null || req.body.periodDays === "" ? null : Number(req.body.periodDays);
  if (!category || (periodDays !== null && (!Number.isInteger(periodDays) || periodDays < 0))) throw ApiError.badRequest("Select a category and enter a whole number of days, or leave days blank until legally reviewed.");
  if (req.body.enabled === true && periodDays == null) throw ApiError.badRequest("Set and document a reviewed retention period before enabling automated cleanup.");
  const policy = await prisma.privacyRetentionPolicy.update({ where: { category }, data: { purpose: String(req.body.purpose || "").trim() || undefined, periodDays, basis: String(req.body.basis || "").trim() || undefined, enabled: Boolean(req.body.enabled), updatedById: req.user.id } });
  await privacy.audit({ actorId: req.user.id, action: "RETENTION_POLICY_UPDATED", subjectType: "retention_policy", subjectId: policy.id, metadata: { category, enabled: policy.enabled }, ip: req.ip });
  return ApiResponse.success(res, 200, "Retention policy saved", policy);
});

const retentionDryRun = asyncHandler(async (req, res) => {
  const policies = await prisma.privacyRetentionPolicy.findMany({ orderBy: { category: "asc" } });
  const report = { generatedAt: new Date().toISOString(), mode: "DRY_RUN_ONLY", note: "No records were changed. Automated deletion is not implemented by this endpoint.", policies: policies.map(({ category, purpose, periodDays, enabled, basis }) => ({ category, purpose, periodDays, enabled, basis, eligibleRecords: null, reason: periodDays == null ? "No reviewed period configured" : "Eligibility query not configured" })) };
  const run = await prisma.privacyRetentionRun.create({ data: { dryRun: true, status: "COMPLETED", report, finishedAt: new Date() } });
  await privacy.audit({ actorId: req.user.id, action: "RETENTION_DRY_RUN", subjectType: "retention_run", subjectId: run.id, ip: req.ip });
  return ApiResponse.success(res, 200, "Dry run completed. No records were changed.", { ...run, report });
});

const breaches = asyncHandler(async (req, res) => {
  if (req.method === "GET") return ApiResponse.success(res, 200, "Breach incidents retrieved", await prisma.privacyBreachIncident.findMany({ orderBy: { discoveredAt: "desc" }, take: 100 }));
  const summary = String(req.body.summary || "").trim();
  if (!summary) throw ApiError.badRequest("Incident summary is required.");
  const discoveredAt = req.body.discoveredAt ? new Date(req.body.discoveredAt) : new Date();
  if (!Number.isFinite(discoveredAt.getTime())) throw ApiError.badRequest("Enter a valid discovery date and time.");
  const incident = await prisma.privacyBreachIncident.create({ data: { reference: `INC-${require("node:crypto").randomBytes(6).toString("hex").toUpperCase()}`, discoveredAt, occurredAt: req.body.occurredAt ? new Date(req.body.occurredAt) : null, summary, affectedCount: Number.isInteger(req.body.affectedCount) && req.body.affectedCount >= 0 ? req.body.affectedCount : null, dataCategories: Array.isArray(req.body.dataCategories) ? req.body.dataCategories : [], affectedUserIds: [], createdById: req.user.id } });
  await privacy.audit({ actorId: req.user.id, action: "BREACH_INCIDENT_CREATED", subjectType: "breach_incident", subjectId: incident.id, metadata: { reference: incident.reference }, ip: req.ip });
  return ApiResponse.success(res, 201, "Incident recorded. Notifications must be approved and sent through the incident process.", incident);
});

const updateBreach = asyncHandler(async (req, res) => {
  const allowedStatuses = new Set(["DISCOVERED", "INVESTIGATING", "CONTAINED", "NOTIFICATIONS_REVIEWED", "RESOLVED"]);
  const status = String(req.body.status || "").toUpperCase();
  if (!allowedStatuses.has(status)) throw ApiError.badRequest("Choose a valid incident status.");
  const data = { status, updatedById: req.user.id };
  for (const key of ["investigation", "containment", "resolution"]) if (req.body[key] !== undefined) data[key] = req.body[key] == null ? null : String(req.body[key]).slice(0, 8000);
  for (const [input, field] of [["boardNoticeAt", "boardNoticeAt"], ["boardDetailedAt", "boardDetailedAt"], ["affectedNoticeAt", "affectedNoticeAt"]]) {
    if (req.body[input] !== undefined) {
      if (req.body[input] === null || req.body[input] === "") data[field] = null;
      else { const date = new Date(req.body[input]); if (!Number.isFinite(date.getTime())) throw ApiError.badRequest(`Enter a valid date for ${input}.`); data[field] = date; }
    }
  }
  const incident = await prisma.privacyBreachIncident.update({ where: { id: req.params.id }, data });
  await privacy.audit({ actorId: req.user.id, action: "BREACH_INCIDENT_UPDATED", subjectType: "breach_incident", subjectId: incident.id, metadata: { status }, ip: req.ip });
  return ApiResponse.success(res, 200, "Incident record updated. No external notifications were sent.", incident);
});

module.exports = { publicNotice, adminLegalDocuments, dashboard, setConsent, createRequest, createGrievance, addNominee, removeNominee, exportData, adminOverview, adminList, adminUpdate, processors, retentionPolicies, retentionDryRun, breaches, updateBreach };
