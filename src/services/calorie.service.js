const calorieRepository = require("../repositories/calorie.repository");
const activityFeed = require("./activityFeed.service");
const { parsePagination, buildMeta } = require("../utils/pagination");

const ACTIVITY_MULTIPLIERS = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9
};

// Calorie adjustment applied on top of TDEE based on the user's goal.
const GOAL_ADJUSTMENTS = {
  WEIGHT_LOSS: -500,
  MUSCLE_GAIN: 300,
  STRENGTH: 200,
  ENDURANCE: 100,
  GENERAL_FITNESS: 0,
  REHAB: 0
};

/**
 * Mifflin-St Jeor equation. For OTHER/PREFER_NOT_TO_SAY we use the
 * average of the male/female offsets to avoid systematic bias.
 */
function computeBmr({ gender, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === "MALE") return base + 5;
  if (gender === "FEMALE") return base - 161;
  return base - 78; // midpoint offset
}

async function calculate(userId, input) {
  const { age, gender, heightCm, weightKg, activityLevel, goal } = input;

  const bmr = Math.round(computeBmr({ gender, weightKg, heightCm, age }) * 10) / 10;
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel] * 10) / 10;
  const targetCalories = Math.max(1200, Math.round((tdee + GOAL_ADJUSTMENTS[goal]) * 10) / 10);

  const log = await calorieRepository.create({
    userId,
    age,
    gender,
    heightCm,
    weightKg,
    activityLevel,
    goal,
    bmr,
    tdee,
    targetCalories
  });

  await activityFeed.record(
    userId,
    "OTHER",
    `Calculated daily calorie target: ${targetCalories} kcal`
  );

  return log;
}

async function history(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    calorieRepository.list(userId, { skip, take: limit }),
    calorieRepository.count(userId)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

module.exports = { calculate, history };
