const router = require("express").Router();
const calendarController = require("../../controllers/calendar.controller");
const googleCalendarController = require("../../controllers/googleCalendar.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const googleCalendarValidator = require("../../validators/googleCalendar.validator");

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

/**
 * @swagger
 * /calendar/google/connect/start:
 *   get:
 *     summary: Get OAuth configuration (scope, client IDs) needed to start a Google Calendar connection
 *     tags: [Calendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Google Calendar OAuth configuration }
 */
router.get("/google/connect/start", authenticate, googleCalendarController.connectStart);

/**
 * @swagger
 * /calendar/google/exchange:
 *   post:
 *     summary: Complete the Google Calendar connection by exchanging an authorization code + PKCE verifier
 *     tags: [Calendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Google Calendar connected }
 */
router.post(
  "/google/exchange",
  authenticate,
  validate(googleCalendarValidator.exchange),
  googleCalendarController.exchange
);

/**
 * @swagger
 * /calendar/google/status:
 *   get:
 *     summary: Check whether the current user has a connected Google Calendar
 *     tags: [Calendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Google Calendar connection status }
 */
router.get("/google/status", authenticate, googleCalendarController.status);

/**
 * @swagger
 * /calendar/google:
 *   delete:
 *     summary: Disconnect the current user's Google Calendar connection
 *     tags: [Calendar]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Google Calendar disconnected }
 */
router.delete("/google", authenticate, googleCalendarController.disconnect);

module.exports = router;
