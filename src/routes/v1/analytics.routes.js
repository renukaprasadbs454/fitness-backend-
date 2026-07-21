const router = require("express").Router();
const analyticsController = require("../../controllers/analytics.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/role.middleware");
const { ROLES } = require("../../constants/roles");

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Admin analytics dashboard — growth, engagement, workout stats, coach performance
 */

router.use(authenticate, requireRole(ROLES.ADMIN));

/**
 * @swagger
 * /admin/analytics/overview:
 *   get:
 *     summary: Combined analytics dashboard payload (growth, engagement, workouts, coaches, content)
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Analytics overview retrieved }
 */
router.get("/overview", analyticsController.overview);

/**
 * @swagger
 * /admin/analytics/user-growth:
 *   get:
 *     summary: Daily + cumulative user registration trend
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200: { description: User growth retrieved }
 */
router.get("/user-growth", analyticsController.userGrowth);

/**
 * @swagger
 * /admin/analytics/engagement:
 *   get:
 *     summary: Active users, workout completion trend, appointment funnel
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200: { description: Engagement metrics retrieved }
 */
router.get("/engagement", analyticsController.engagement);

/**
 * @swagger
 * /admin/analytics/workouts:
 *   get:
 *     summary: Workout completion breakdown by category + top plans
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Workout stats retrieved }
 */
router.get("/workouts", analyticsController.workoutStats);

/**
 * @swagger
 * /admin/analytics/coaches:
 *   get:
 *     summary: Per-coach appointment volume and completion rate
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coach performance retrieved }
 */
router.get("/coaches", analyticsController.coachPerformance);

module.exports = router;
