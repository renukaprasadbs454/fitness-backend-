const test = require("node:test");
const assert = require("node:assert/strict");

const calls = {};
const fakeDb = {
  privacyPurpose: { findUnique: async () => ({ key: "notifications", enabled: true, essential: false }) },
  privacyNotice: { findFirst: async () => ({ id: "notice-1", version: "test-v1" }) },
  privacyAuditLog: { create: async (args) => { calls.exportAudit = args; } },
  privacyRequest: {
    findFirst: async (args) => { calls.requestLookup = args; return null; },
    create: async (args) => { calls.requestCreate = args; return { id: "request-1", status: "OPEN", ...args.data }; },
    findUnique: async (args) => { calls.adminRequestLookup = args; return { type: "DELETION" }; },
    update: async (args) => { calls.adminRequestUpdate = args; return { id: args.where.id, userId: "user-own", ...args.data }; }
  },
  privacyGrievance: { create: async (args) => { calls.grievanceCreate = args; return { id: "grievance-1", reference: "PRV-TEST", ...args.data }; } },
  privacyNominee: {
    count: async () => 0,
    create: async (args) => { calls.nomineeCreate = args; return { id: "nominee-1", createdAt: new Date(0), ...args.data }; },
    updateMany: async (args) => { calls.nomineeRemove = args; return { count: 1 }; }
  },
  $transaction: async (callback) => callback({
    privacyConsentRecord: { create: async (args) => { calls.record = args; return { id: "consent-1", ...args.data }; } },
    privacyConsentWithdrawal: { create: async (args) => { calls.withdrawal = args; } },
    notificationPreference: { upsert: async (args) => { calls.preferences = args; } },
    privacyAuditLog: { create: async (args) => { calls.audit = args; } }
  }),
  chatRoom: { findMany: async () => [{ id: "room-own" }] }
};
const dbPath = require.resolve("../src/database/prismaClient");
const exportPath = require.resolve("../src/services/userDataExport.service");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };
require.cache[exportPath] = { id: exportPath, filename: exportPath, loaded: true, exports: {
  buildUserDataExport: async () => ({ records: {
    chat_rooms: [{ id: "room-own" }, { id: "room-other" }],
    chat_messages: [{ roomId: "room-own" }, { roomId: "room-other" }],
    appointments: [{ userId: "user-own" }, { userId: "user-other" }],
    assigned_workout_plans: [{ userId: "user-own", planId: "plan-own" }, { userId: "user-other", planId: "plan-other" }],
    custom_workouts: [{ id: "custom-own", userId: "user-own" }, { id: "custom-other", userId: "user-other" }],
    custom_workout_exercises: [{ customWorkoutId: "custom-own" }, { customWorkoutId: "custom-other" }],
    workout_completions: [{ planId: "plan-own" }], scheduled_workouts: [{ planId: "plan-own", userId: "user-own" }],
    workout_plans: [{ id: "plan-own" }, { id: "plan-other" }],
    workout_plan_exercises: [{ planId: "plan-own", exerciseId: "exercise-own" }, { planId: "plan-other", exerciseId: "exercise-other" }],
    exercises: [{ id: "exercise-own" }, { id: "exercise-other" }],
    coach_reports: [{ userId: "user-own" }, { userId: "user-other" }],
    admin_audit_logs: [{ targetId: "user-own" }, { targetId: "user-other" }]
  } }), buildUserDataCsv: (data) => data }
};
const privacy = require("../src/services/privacy.service");

test("notification consent withdrawal is recorded atomically and disables notification channels", async () => {
  calls.record = calls.withdrawal = calls.preferences = calls.audit = undefined;
  await privacy.recordConsent("user-own", "notifications", false, { ip: "127.0.0.1", userAgent: "test" });
  assert.equal(calls.record.data.granted, false);
  assert.equal(calls.withdrawal.data.consentRecordId, "consent-1");
  assert.equal(calls.preferences.update.coachMessages, false);
  assert.equal(calls.preferences.create.announcements, false);
  assert.equal(calls.audit.data.action, "CONSENT_WITHDRAWN");
});

test("self-service export contains only records belonging to the requesting account", async () => {
  const exported = await privacy.exportOwnData("user-own", "json");
  for (const [table, rows] of Object.entries(exported.records)) {
    assert.ok(Array.isArray(rows), `${table} is an array`);
    assert.equal(rows.length, 1, `${table} has exactly one own row`);
  }
  assert.equal(exported.records.chat_messages[0].roomId, "room-own");
  assert.equal(exported.records.exercises[0].id, "exercise-own");
});

test("correction requests are owner-scoped, validated and recorded for admin review", async () => {
  calls.requestCreate = calls.requestLookup = calls.exportAudit = undefined;
  const request = await privacy.createRequest("user-own", {
    type: "CORRECTION", subject: "Correct my goal", details: "Please update my fitness goal."
  }, "127.0.0.1");
  assert.equal(request.status, "OPEN");
  assert.deepEqual(calls.requestCreate.data, {
    userId: "user-own", type: "CORRECTION", subject: "Correct my goal",
    details: "Please update my fitness goal.", requestedFields: []
  });
  assert.equal(calls.exportAudit.data.userId, "user-own");
});

test("a duplicate active deletion request is rejected before another request is created", async () => {
  fakeDb.privacyRequest.findFirst = async (args) => { calls.requestLookup = args; return { id: "existing-deletion" }; };
  calls.requestCreate = undefined;
  await assert.rejects(
    privacy.createRequest("user-own", { type: "DELETION", subject: "Delete account", details: "Please review deletion." }),
    /already have an account deletion request/
  );
  assert.equal(calls.requestLookup.where.userId, "user-own");
  assert.equal(calls.requestCreate, undefined);
  fakeDb.privacyRequest.findFirst = async (args) => { calls.requestLookup = args; return null; };
});

test("nominee removal query is scoped to both nominee id and owner", async () => {
  calls.nomineeRemove = undefined;
  await privacy.removeNominee("user-own", "nominee-1");
  assert.deepEqual(calls.nomineeRemove.where, { id: "nominee-1", userId: "user-own", isActive: true });
});

test("admin cannot mark account deletion complete or approve destructive work in the privacy console", async () => {
  calls.adminRequestUpdate = undefined;
  await assert.rejects(
    privacy.updateAdminRecord("requests", "request-1", { status: "COMPLETED", response: "Done", manualWorkCompleted: true }, "admin-1"),
    /Deletion requests cannot be closed here/
  );
  await assert.rejects(
    privacy.updateAdminRecord("requests", "request-1", { status: "APPROVED" }, "admin-1"),
    /cannot approve destructive work/
  );
  assert.equal(calls.adminRequestUpdate, undefined);
});
