const router = require("express").Router();
const adminController = require("../../controllers/admin.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/admin.validator");
const engagementSchemas = require("../../validators/engagement.validator");
const integrationController = require("../../controllers/integration.controller");
const { ROLES } = require("../../constants/roles");

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin-only user/coach management, dashboard stats, and audit logs
 */

// Every route below requires a valid admin JWT — reuses the same
// /auth/login + access/refresh token flow as the rest of the API.
router.use(authenticate, requireRole(ROLES.ADMIN));

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Aggregate dashboard stats (totals, new registrations, recent users)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard stats retrieved }
 */
router.get("/dashboard", adminController.dashboardStats);

// ── Users ──────────────────────────────────────────────────

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List/search/filter/paginate users
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [USER, COACH, ADMIN] }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Users retrieved }
 */
router.get("/users", validate(schemas.listUsers), adminController.listUsers);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Get full user details (profile + coach relation if any)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User retrieved }
 */
router.get("/users/:id", validate(schemas.idParam), adminController.getUserById);

/**
 * @swagger
 * /admin/users/{id}:
 *   put:
 *     summary: Update a user's basic info (name, email, phone)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User updated }
 */
router.put("/users/:id", validate(schemas.updateUser), adminController.updateUser);

/**
 * @swagger
 * /admin/users/{id}/suspend:
 *   patch:
 *     summary: Suspend a user (deactivates + revokes their sessions)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User suspended }
 */
router.patch("/users/:id/suspend", validate(schemas.idParam), adminController.suspendUser);

/**
 * @swagger
 * /admin/users/{id}/activate:
 *   patch:
 *     summary: Reactivate a suspended user
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User activated }
 */
router.patch("/users/:id/activate", validate(schemas.idParam), adminController.activateUser);

/**
 * @swagger
 * /admin/users/{id}/role:
 *   patch:
 *     summary: Change a user's role (USER/COACH/ADMIN)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User role updated }
 */
router.patch("/users/:id/role", validate(schemas.changeRole), adminController.changeUserRole);

/**
 * @swagger
 * /admin/users/{id}/coach:
 *   put:
 *     summary: Assign a user to a coach (coachId = null to unassign). One coach per user.
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Assignment updated }
 *       404: { description: User or coach not found }
 */
router.put("/users/:id/coach", validate(schemas.assignCoach), adminController.assignCoach);

/**
 * @swagger
 * /admin/users/{id}/reset-password:
 *   post:
 *     summary: Reset a user's password (auto-generates one if not supplied) and revokes their sessions
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Password reset }
 */
router.post(
  "/users/:id/reset-password",
  validate(schemas.resetPassword),
  adminController.resetUserPassword
);

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     summary: Permanently delete a user and all their data
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User deleted }
 */
router.delete("/users/:id", validate(schemas.idParam), adminController.deleteUser);

// ── Coaches ────────────────────────────────────────────────

/**
 * @swagger
 * /admin/coaches:
 *   get:
 *     summary: List/search/paginate coaches
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coaches retrieved }
 */
router.get("/coaches", validate(schemas.listCoachesAdmin), adminController.listCoaches);

/**
 * @swagger
 * /admin/coaches:
 *   post:
 *     summary: Promote an existing user to COACH and create their coach profile
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Coach created }
 */
router.post("/coaches", validate(schemas.createCoach), adminController.createCoach);

/**
 * @swagger
 * /admin/coaches/{id}:
 *   put:
 *     summary: Update a coach's profile
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coach updated }
 */
router.put("/coaches/:id", validate(schemas.updateCoach), adminController.updateCoach);

/**
 * @swagger
 * /admin/coaches/{id}:
 *   delete:
 *     summary: Remove a coach profile and demote the user back to USER
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coach deleted }
 */
router.delete("/coaches/:id", validate(schemas.idParam), adminController.deleteCoach);

/**
 * @swagger
 * /admin/coaches/{id}/clients:
 *   get:
 *     summary: List the users assigned to a coach
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coach clients retrieved }
 */
router.get("/coaches/:id/clients", validate(schemas.idParam), adminController.listCoachClients);

// ── Audit logs ─────────────────────────────────────────────

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: List admin action audit logs (filterable by target)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Audit logs retrieved }
 */
router.get("/audit-logs", validate(schemas.listAuditLogs), adminController.listAuditLogs);

// ── Payments ─────────────────────────────────────────────────

/**
 * @swagger
 * /admin/payments:
 *   get:
 *     summary: List/filter/paginate payments
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, SUCCESS, FAILED, REFUNDED] }
 *       - in: query
 *         name: purpose
 *         schema: { type: string, enum: [COACH_SESSION, SUBSCRIPTION, CUSTOM_WORKOUT_PLAN, OTHER] }
 *     responses:
 *       200: { description: Payments retrieved }
 */
router.get("/payments", validate(schemas.listPayments), adminController.listPayments);

// ── Announcements (Phase 3) ─────────────────────────────────

/**
 * @swagger
 * /admin/announcements:
 *   post:
 *     summary: Broadcast a push + in-app announcement to all active users (optionally scoped to a role)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               role: { type: string, enum: [USER, COACH] }
 *     responses:
 *       200: { description: Announcement broadcast }
 */
router.post(
  "/announcements",
  validate(schemas.broadcastAnnouncement),
  adminController.broadcastAnnouncement
);

// ── Image storage self-test ──────────────────────────────

/**
 * @swagger
 * /admin/storage/check:
 *   get:
 *     summary: Self-test image storage - uploads a tiny image, downloads it the way the apps do, and reports each step
 *     tags: [Admin]
 *     responses:
 *       200: { description: Report with ok true/false and per-step details }
 */
router.get("/storage/check", adminController.checkStorage);

// ── Support requests ─────────────────────────────────────

/**
 * @swagger
 * /admin/support/tickets:
 *   get:
 *     summary: List support requests raised by users (filter by status/category, search text)
 *     tags: [Admin]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED] } }
 *       - { in: query, name: category, schema: { type: string, enum: [GENERAL, ACCOUNT, PAYMENT, TECHNICAL, COACH, OTHER] } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses:
 *       200: { description: Support requests retrieved (meta.counts has totals per status) }
 * /admin/support/tickets/{id}:
 *   patch:
 *     summary: Reply to and/or change the status of a support request (the user is notified)
 *     tags: [Admin]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED] }
 *               adminReply: { type: string, nullable: true }
 *     responses:
 *       200: { description: Support request updated }
 */
router.get("/support/tickets", validate(engagementSchemas.listSupportTickets), adminController.listSupportTickets);
router.patch("/support/tickets/:id", validate(engagementSchemas.updateSupportTicket), adminController.updateSupportTicket);

/**
 * @swagger
 * /admin/support/tickets/{id}:
 *   delete:
 *     summary: Delete a support request
 *     tags: [Admin]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Support request deleted }
 */
router.delete("/support/tickets/:id", validate(engagementSchemas.supportTicketIdParam), adminController.deleteSupportTicket);

// ── Coach reports ────────────────────────────────────────

/**
 * @swagger
 * /admin/coach-reports:
 *   get:
 *     summary: List reports users have made about coaches
 *     tags: [Admin]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [OPEN, REVIEWING, RESOLVED, DISMISSED] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses:
 *       200: { description: Coach reports retrieved (meta.counts has totals per status) }
 * /admin/coach-reports/{id}:
 *   patch:
 *     summary: Change a report's status and/or note (the user is notified of status changes)
 *     tags: [Admin]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [OPEN, REVIEWING, RESOLVED, DISMISSED] }
 *               adminNote: { type: string, nullable: true }
 *     responses:
 *       200: { description: Report updated }
 * /admin/coach-reports/{id}/reassign:
 *   post:
 *     summary: Resolve a report by moving the user to another coach (coachId null removes their coach)
 *     tags: [Admin]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [coachId]
 *             properties:
 *               coachId: { type: string, format: uuid, nullable: true }
 *               adminNote: { type: string }
 *     responses:
 *       200: { description: User moved to the new coach and report resolved }
 */
router.get("/coach-reports", validate(engagementSchemas.listCoachReports), adminController.listCoachReports);
router.patch("/coach-reports/:id", validate(engagementSchemas.updateCoachReport), adminController.updateCoachReport);
router.post("/coach-reports/:id/reassign", validate(engagementSchemas.reassignFromReport), adminController.reassignFromCoachReport);

// ── Integrations: platform Google account for Meet links ──

/**
 * @swagger
 * /admin/integrations/google-meet:
 *   get:
 *     summary: Whether a platform Google account is connected for generating Meet links
 *     tags: [Admin]
 *     responses:
 *       200: { description: Integration status (includes the redirect URI to register in Google Cloud) }
 *   delete:
 *     summary: Disconnect the platform Google account (links already created keep working)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Google account disconnected }
 * /admin/integrations/google-meet/connect:
 *   post:
 *     summary: Get the Google consent URL to connect the platform account (open it in the browser)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Consent URL }
 */
router.get("/integrations/google-meet", integrationController.googleMeetStatus);
router.post("/integrations/google-meet/connect", integrationController.googleMeetConnectUrl);
router.delete("/integrations/google-meet", integrationController.googleMeetDisconnect);

// ── Dynamic Database Explorer (Prisma Studio integration) ──

/**
 * @swagger
 * /admin/db/tables:
 *   get:
 *     summary: List every database table with its columns and relations
 *     tags: [Admin]
 *     responses:
 *       200: { description: Schema retrieved }
 * /admin/db/tables/{tableName}:
 *   get:
 *     summary: List rows of a table (paginated)
 *     tags: [Admin]
 *     parameters:
 *       - { in: path, name: tableName, required: true, schema: { type: string }, example: packages }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer, maximum: 200 } }
 *     responses:
 *       200: { description: Rows retrieved }
 *       404: { description: Table not found }
 *   post:
 *     summary: Insert a row into a table
 *     tags: [Admin]
 *     parameters:
 *       - { in: path, name: tableName, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, additionalProperties: true }
 *     responses:
 *       201: { description: Row created }
 * /admin/db/tables/{tableName}/{id}:
 *   put:
 *     summary: Update a row by its primary key
 *     tags: [Admin]
 *     parameters:
 *       - { in: path, name: tableName, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, additionalProperties: true }
 *     responses:
 *       200: { description: Row updated }
 *   delete:
 *     summary: Delete a row by its primary key
 *     tags: [Admin]
 *     parameters:
 *       - { in: path, name: tableName, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Row deleted }
 * /admin/db/relation-options/{modelName}:
 *   get:
 *     summary: id/label options for a model, used to pick foreign keys
 *     tags: [Admin]
 *     parameters:
 *       - { in: path, name: modelName, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Options retrieved }
 */
router.get("/db/tables", adminController.getDatabaseSchema);
router.get("/db/tables/:tableName", adminController.getModelData);
router.post("/db/tables/:tableName", adminController.createModelRow);
router.put("/db/tables/:tableName/:id", adminController.updateModelRow);
router.delete("/db/tables/:tableName/:id", adminController.deleteModelRow);
router.get("/db/relation-options/:modelName", adminController.getRelationOptions);

module.exports = router;

