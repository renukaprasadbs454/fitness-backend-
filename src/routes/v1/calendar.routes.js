const router = require("express").Router();
const calendarController = require("../../controllers/calendar.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Calendar
 *   description: Upcoming appointments and workout reminders
 */

/**
 * @swagger
 * /calendar/upcoming:
 *   get:
 *     summary: List upcoming appointments and reminders for the current user
 *     tags: [Calendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Upcoming calendar items retrieved }
 */
router.get("/upcoming", authenticate, calendarController.upcoming);

module.exports = router;
