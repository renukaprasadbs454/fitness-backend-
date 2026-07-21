const workoutRepository = require("../repositories/workout.repository");
const userRepository = require("../repositories/user.repository");
const bmiRepository = require("../repositories/bmi.repository");
const calorieRepository = require("../repositories/calorie.repository");
const appointmentRepository = require("../repositories/appointment.repository");
const ApiError = require("../utils/ApiError");
const activityFeed = require("./activityFeed.service");
const { parsePagination, buildMeta } = require("../utils/pagination");

// Maps a user's fitness Goal onto the closest WorkoutCategoryKey.
const GOAL_TO_CATEGORY = {
  WEIGHT_LOSS: "WEIGHT_LOSS",
  MUSCLE_GAIN: "MUSCLE_GAIN",
  STRENGTH: "STRENGTH",
  ENDURANCE: "CARDIO",
  GENERAL_FITNESS: "GENERAL_FITNESS",
  REHAB: "YOGA"
};

function toPlanDto(plan) {
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    duration: `${plan.durationMinutes} min`,
    difficulty: plan.difficulty.charAt(0) + plan.difficulty.slice(1).toLowerCase(),
    accent: plan.accentColor,
    category: plan.categoryKey,
    exercises: (plan.exercises || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((e) => e.exercise.name),
    exerciseDetails: (plan.exercises || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((e) => ({
        id: e.exercise.id,
        name: e.exercise.name,
        muscleGroup: e.exercise.muscleGroup,
        equipment: e.exercise.equipment,
        sets: e.sets,
        reps: e.reps
      }))
  };
}

async function listPlans(query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    workoutRepository.listPlans({ skip, take: limit, category: query.category, difficulty: query.difficulty }),
    workoutRepository.countPlans({ category: query.category, difficulty: query.difficulty })
  ]);
  return { items: items.map(toPlanDto), meta: buildMeta(page, limit, total) };
}

async function getPlanById(id) {
  const plan = await workoutRepository.findPlanById(id);
  if (!plan) throw ApiError.notFound("Workout plan not found");
  return toPlanDto(plan);
}

async function createPlan({ exercises, ...data }) {
  const plan = await workoutRepository.createPlan(data, exercises);
  return toPlanDto(plan);
}

async function updatePlan(id, { exercises, ...data }) {
  const existing = await workoutRepository.findPlanById(id);
  if (!existing) throw ApiError.notFound("Workout plan not found");
  const plan = await workoutRepository.updatePlan(id, data, exercises);
  return toPlanDto(plan);
}

async function deletePlan(id) {
  const existing = await workoutRepository.findPlanById(id);
  if (!existing) throw ApiError.notFound("Workout plan not found");
  await workoutRepository.deletePlan(id);
}

async function completePlan(userId, planId) {
  const plan = await workoutRepository.findPlanById(planId);
  if (!plan) throw ApiError.notFound("Workout plan not found");
  const completion = await workoutRepository.createCompletion(userId, planId);
  await activityFeed.record(userId, "WORKOUT_COMPLETED", `Completed ${plan.title} workout`);
  return completion;
}

/**
 * Recommendation engine: goal (from profile) picks the category,
 * latest BMI category adjusts difficulty toward something achievable.
 */
/**
 * Phase 3 recommendation engine.
 *
 * Signals used, in order of influence:
 *  1. Goal (profile.goal)              -> base category
 *  2. Latest BMI category              -> base difficulty floor
 *  3. Latest calorie calc activityLevel -> nudges difficulty up/down
 *  4. Confirmed/completed coach appointment specialties -> can override category
 *     when it overlaps a recognized category keyword (explicit coach assignment signal)
 *  5. Completion history in the chosen category -> progressive difficulty
 *     (enough completions at a level bumps the recommendation up a tier)
 *     and avoids immediately repeating the last completed plan
 */
const DIFFICULTY_ORDER = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const ACTIVITY_LEVEL_ADJUST = {
  SEDENTARY: -1,
  LIGHT: 0,
  MODERATE: 0,
  ACTIVE: 1,
  VERY_ACTIVE: 1
};

function clampDifficultyIndex(idx) {
  return Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, idx));
}

async function recommended(userId) {
  const [profile, latestBmi, latestCalorie, upcomingAppointments, completions] = await Promise.all([
    userRepository.findProfileByUserId(userId),
    bmiRepository.latest(userId),
    calorieRepository.latest(userId),
    appointmentRepository.upcomingForUser(userId, 5),
    workoutRepository.completionsByUser(userId, 15)
  ]);

  let category = GOAL_TO_CATEGORY[profile?.goal] || "GENERAL_FITNESS";

  // Coach-assignment signal: if the user has a confirmed/pending appointment
  // with a coach whose specialties clearly name a workout category, prefer it —
  // an active coach relationship is a stronger signal than a static goal field.
  const assignedCoach = upcomingAppointments.find((a) => a.status === "CONFIRMED")?.coach;
  if (assignedCoach?.specialties?.length) {
    const specialtyMatch = assignedCoach.specialties
      .map((s) => s.toUpperCase().replace(/\s+/g, "_"))
      .find((s) => Object.values(GOAL_TO_CATEGORY).includes(s));
    if (specialtyMatch) category = specialtyMatch;
  }

  // Base difficulty from BMI.
  let difficultyIndex = 1; // INTERMEDIATE
  if (latestBmi && ["Underweight", "Obese"].includes(latestBmi.category)) {
    difficultyIndex = 0; // BEGINNER
  }

  // Adjust by recent activity level from the calorie calculator (captures
  // real day-to-day activity, not just a one-time goal selection).
  if (latestCalorie?.activityLevel && latestCalorie.activityLevel in ACTIVITY_LEVEL_ADJUST) {
    difficultyIndex += ACTIVITY_LEVEL_ADJUST[latestCalorie.activityLevel];
  }

  // Progressive overload: enough completions at the current level in this
  // category nudges the recommendation up a tier.
  const completionsInCategory = completions.filter((c) => c.plan.categoryKey === category);
  const completionsAtCurrentLevel = completionsInCategory.filter(
    (c) => c.plan.difficulty === DIFFICULTY_ORDER[clampDifficultyIndex(difficultyIndex)]
  ).length;
  if (completionsAtCurrentLevel >= 5) difficultyIndex += 1;

  difficultyIndex = clampDifficultyIndex(difficultyIndex);
  const preferredDifficulty = DIFFICULTY_ORDER[difficultyIndex];

  let plans = await workoutRepository.plansByCategory(category, 8);
  let matched = plans.filter((p) => p.difficulty === preferredDifficulty);
  if (matched.length === 0) matched = plans; // fall back to any difficulty in category
  if (matched.length === 0) {
    matched = await workoutRepository.plansByCategory("GENERAL_FITNESS", 8);
  }

  // Variety: avoid recommending the exact plan the user just completed
  // if there's another option available.
  const lastCompletedId = completions[0]?.planId;
  if (matched.length > 1 && lastCompletedId) {
    const withoutLast = matched.filter((p) => p.id !== lastCompletedId);
    if (withoutLast.length > 0) matched = withoutLast;
  }

  return {
    basedOn: {
      goal: profile?.goal || null,
      bmiCategory: latestBmi?.category || null,
      activityLevel: latestCalorie?.activityLevel || null,
      coachAssigned: !!assignedCoach,
      completionsConsidered: completions.length,
      recommendedCategory: category,
      recommendedDifficulty: preferredDifficulty
    },
    plans: matched.slice(0, 5).map(toPlanDto)
  };
}

// ── Exercise library (admin CRUD) ─────────────────────────

async function listExercises(query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    workoutRepository.listExercises({ skip, take: limit, q: query.q }),
    workoutRepository.countExercises(query.q)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function createExercise(data) {
  return workoutRepository.createExercise(data);
}

async function updateExercise(id, data) {
  const existing = await workoutRepository.findExerciseById(id);
  if (!existing) throw ApiError.notFound("Exercise not found");
  return workoutRepository.updateExercise(id, data);
}

async function deleteExercise(id) {
  const existing = await workoutRepository.findExerciseById(id);
  if (!existing) throw ApiError.notFound("Exercise not found");
  await workoutRepository.deleteExercise(id);
}

module.exports = {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  completePlan,
  recommended,
  listExercises,
  createExercise,
  updateExercise,
  deleteExercise
};
