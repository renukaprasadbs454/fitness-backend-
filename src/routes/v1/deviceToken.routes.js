const router = require("express").Router();
const notificationController = require("../../controllers/notification.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/notification.validator");

/**
 * @swagger
 * tags:
 *   name: DeviceTokens
 *   description: FCM device token registration for push notifications
 */

/**
 * @swagger
 * /device-tokens:
 *   post:
 *     summary: Register (or refresh) an FCM device token for push notifications
 *     tags: [DeviceTokens]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Device registered }
 */
router.post(
  "/",
  authenticate,
  validate(schemas.registerDevice),
  notificationController.registerDevice
);

/**
 * @swagger
 * /device-tokens:
 *   delete:
 *     summary: Unregister an FCM device token (e.g. on logout)
 *     tags: [DeviceTokens]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200: { description: Device unregistered }
 */
router.delete(
  "/",
  authenticate,
  validate(schemas.unregisterDevice),
  notificationController.unregisterDevice
);

module.exports = router;
