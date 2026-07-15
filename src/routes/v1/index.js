const router = require("express").Router();

const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const coachRoutes = require("./coach.routes");
const uploadRoutes = require("./upload.routes");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/coaches", coachRoutes);
router.use("/uploads", uploadRoutes);

router.get("/health", (req, res) => res.json({ success: true, message: "OK" }));

module.exports = router;
