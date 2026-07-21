const router = require("express").Router();
const activityController = require("../../controllers/activity.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/activity.validator");

/**
 * @swagger
 * tags:
 *   name: Steps
 *   description: Daily step tracking
 */

/**
 * @swagger
 * /steps:
 *   post:
 *     summary: Log (or update) today's step count
 *     tags: [Steps]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Steps logged }
 */
router.post("/", authenticate, validate(schemas.logSteps), activityController.logSteps);

/**
 * @swagger
 * /steps:
 *   get:
 *     summary: List step logs (paginated, optional date range)
 *     tags: [Steps]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Step logs retrieved }
 */
router.get("/", authenticate, validate(schemas.listSteps), activityController.listSteps);

module.exports = router;
