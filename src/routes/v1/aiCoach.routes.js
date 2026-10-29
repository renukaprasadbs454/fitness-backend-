const router = require("express").Router();
const chatController = require("../../controllers/aiCoach.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

/**
 * @swagger
 * /chat/coach-reply:
 *   post:
 *     summary: Get an AI coach reply to a message
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *     responses:
 *       200: { description: Reply generated }
 */
router.post("/coach-reply", authenticate, chatController.coachReply);

module.exports = router;
