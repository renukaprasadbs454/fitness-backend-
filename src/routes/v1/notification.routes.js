const router = require("express").Router();
const notificationController = require("../../controllers/notification.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/notification.validator");

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: In-app notification feed
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List the current user's notifications (paginated)
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Notifications retrieved }
 */
router.get("/", authenticate, validate(schemas.listNotifications), notificationController.list);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all of the current user's notifications as read
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: All notifications marked as read }
 */
router.patch("/read-all", authenticate, notificationController.markAllRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notification marked as read }
 */
router.patch(
  "/:id/read",
  authenticate,
  validate(schemas.idParam),
  notificationController.markRead
);

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     summary: Get the current user's notification preferences
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notification preferences retrieved }
 */
router.get("/preferences", authenticate, notificationController.getPreferences);

/**
 * @swagger
 * /notifications/preferences:
 *   patch:
 *     summary: Update the current user's notification preferences
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workoutReminders: { type: boolean }
 *               appointmentReminders: { type: boolean }
 *               coachMessages: { type: boolean }
 *               announcements: { type: boolean }
 *     responses:
 *       200: { description: Notification preferences updated }
 */
router.patch(
  "/preferences",
  authenticate,
  validate(schemas.updatePreferences),
  notificationController.updatePreferences
);

module.exports = router;
