const bmiRepository = require("../repositories/bmi.repository");
const userRepository = require("../repositories/user.repository");
const activityFeed = require("./activityFeed.service");
const { parsePagination, buildMeta } = require("../utils/pagination");

function classify(bmi) {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function computeBmi(heightCm, weightKg) {
  const heightM = heightCm / 100;
  const raw = weightKg / (heightM * heightM);
  return Math.round(raw * 10) / 10;
}

async function calculate(userId, { heightCm, weightKg }) {
  const bmi = computeBmi(heightCm, weightKg);
  const category = classify(bmi);

  const log = await bmiRepository.create({
    userId,
    heightCm,
    weightKg,
    bmi,
    category
  });

  // Keep the profile's latest height/weight in sync so other modules
  // (calorie calculator defaults, dashboard stats) stay accurate.
  await userRepository.upsertProfile(userId, { heightCm, weightKg });

  await activityFeed.record(userId, "BMI_LOGGED", `Logged BMI: ${bmi} (${category})`);

  return log;
}

async function history(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    bmiRepository.list(userId, { skip, take: limit }),
    bmiRepository.count(userId)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

module.exports = { calculate, history, computeBmi, classify };
