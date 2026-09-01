const router = require("express").Router();

const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const coachRoutes = require("./coach.routes");
const uploadRoutes = require("./upload.routes");
const bmiRoutes = require("./bmi.routes");
const calorieRoutes = require("./calorie.routes");
const stepsRoutes = require("./steps.routes");
const activityRoutes = require("./activity.routes");
const progressRoutes = require("./progress.routes");
const workoutRoutes = require("./workout.routes");
const customWorkoutRoutes = require("./customWorkout.routes");
const workoutAssignmentRoutes = require("./workoutAssignment.routes");
const appointmentRoutes = require("./appointment.routes");
const calendarRoutes = require("./calendar.routes");
const deviceTokenRoutes = require("./deviceToken.routes");
const notificationRoutes = require("./notification.routes");
const adminRoutes = require("./admin.routes");
const chatRoutes = require("./chat.routes");
const aiCoachRoutes = require("./aiCoach.routes");
const contentRoutes = require("./content.routes");
const analyticsRoutes = require("./analytics.routes");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/coaches", coachRoutes);
router.use("/uploads", uploadRoutes);
router.use("/bmi", bmiRoutes);
router.use("/calorie", calorieRoutes);
router.use("/steps", stepsRoutes);
router.use("/activity", activityRoutes);
router.use("/progress", progressRoutes);
router.use("/workouts", workoutRoutes);
router.use("/custom-workouts", customWorkoutRoutes);
router.use("/workout-assignments", workoutAssignmentRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/calendar", calendarRoutes);
router.use("/device-tokens", deviceTokenRoutes);
router.use("/notifications", notificationRoutes);
router.use("/admin", adminRoutes);
router.use("/admin/analytics", analyticsRoutes);
router.use("/chat", chatRoutes);
router.use("/chat", aiCoachRoutes); // adds POST /chat/coach-reply (Gemini AI coach) alongside real chat under /chat
router.use("/content", contentRoutes);

router.get("/health", (req, res) => res.json({ success: true, message: "OK" }));

module.exports = router;
