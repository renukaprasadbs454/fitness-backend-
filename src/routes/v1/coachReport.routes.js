const router = require("express").Router();
const controller = require("../../controllers/engagement.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/engagement.validator");

/**
 * @swagger
 * tags:
 *   name: CoachReports
 *   description: Users reporting a problem with a coach (reviewed by admins, who can reassign the user)
 */

/**
 * @swagger
 * /coach-reports:
 *   post:
 *     summary: Report a coach
 *     tags: [CoachReports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [coachId, reason]
 *             properties:
 *               coachId: { type: string, format: uuid }
 *               reason: { type: string, enum: [UNRESPONSIVE, MISSED_SESSIONS, UNPROFESSIONAL, NOT_A_GOOD_FIT, INAPPROPRIATE_BEHAVIOUR, OTHER] }
 *               details: { type: string }
 *               wantsNewCoach: { type: boolean, description: "Ask to be moved to a different coach" }
 *     responses:
 *       201: { description: Report submitted }
 *       409: { description: An open report about this coach already exists }
 * /coach-reports/mine:
 *   get:
 *     summary: List reports the current user has made, with their status and outcome
 *     tags: [CoachReports]
 *     responses:
 *       200: { description: Reports retrieved }
 */
router.post("/", authenticate, validate(schemas.createCoachReport), controller.createCoachReport);
router.get("/mine", authenticate, controller.listMyCoachReports);

module.exports = router;
