const router = require("express").Router();
const activityController = require("../../controllers/activity.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/activity.validator");

/**
 * @swagger
 * tags:
 *   name: Activity
 *   description: Aggregated activity reports
 */

/**
 * @swagger
 * /activity/report:
 *   get:
 *     summary: Daily/weekly/monthly activity statistics (steps, calories, active minutes)
 *     tags: [Activity]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema: { type: string, enum: [daily, weekly, monthly] }
 *     responses:
 *       200: { description: Activity report retrieved }
 */
router.get("/report", authenticate, validate(schemas.report), activityController.report);

module.exports = router;
