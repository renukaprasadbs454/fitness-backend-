const router = require("express").Router();
const chatController = require("../../controllers/aiCoach.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.post("/coach-reply", authenticate, chatController.coachReply);

module.exports = router;
