const router = require("express").Router();
const adminController = require("../../controllers/admin.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/admin.validator");
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

// ── Dynamic Database Explorer (Prisma Studio integration) ──
router.get("/db/tables", adminController.getDatabaseSchema);
router.get("/db/tables/:tableName", adminController.getModelData);
router.post("/db/tables/:tableName", adminController.createModelRow);
router.put("/db/tables/:tableName/:id", adminController.updateModelRow);
router.delete("/db/tables/:tableName/:id", adminController.deleteModelRow);
router.get("/db/relation-options/:modelName", adminController.getRelationOptions);

module.exports = router;

