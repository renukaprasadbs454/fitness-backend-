const router = require("express").Router();
const controller = require("../../controllers/engagement.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/engagement.validator");

/**
 * @swagger
 * tags:
 *   name: Support
 *   description: Help requests raised from the app, answered by admins in the admin portal
 */

/**
 * @swagger
 * /support/tickets:
 *   post:
 *     summary: Raise a support request
 *     tags: [Support]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, message]
 *             properties:
 *               category: { type: string, enum: [GENERAL, ACCOUNT, PAYMENT, TECHNICAL, COACH, OTHER] }
 *               subject: { type: string, example: "Progress photo won't upload" }
 *               message: { type: string }
 *     responses:
 *       201: { description: Support request sent }
 * /support/tickets/mine:
 *   get:
 *     summary: List the current user's support requests with admin replies
 *     tags: [Support]
 *     responses:
 *       200: { description: Support requests retrieved }
 */
router.post("/tickets", authenticate, validate(schemas.createSupportTicket), controller.createSupportTicket);

/**
 * @swagger
 * /support/tickets/{id}:
 *   put:
 *     summary: Edit your own support request (only while it is still Open and unanswered)
 *     tags: [Support]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category: { type: string, enum: [GENERAL, ACCOUNT, PAYMENT, TECHNICAL, COACH, OTHER] }
 *               subject: { type: string }
 *               message: { type: string }
 *     responses:
 *       200: { description: Support request updated }
 *       409: { description: Support has already started on it }
 *   delete:
 *     summary: Delete your own support request
 *     tags: [Support]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Support request deleted }
 */
router.put("/tickets/:id", authenticate, validate(schemas.updateMySupportTicket), controller.updateMySupportTicket);
router.delete("/tickets/:id", authenticate, validate(schemas.supportTicketIdParam), controller.deleteMySupportTicket);
router.get("/tickets/mine", authenticate, controller.listMySupportTickets);

module.exports = router;
