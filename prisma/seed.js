/**
 * Seeds the exercise library + workout plans so Phase 2 endpoints return
 * real data out of the box. Content intentionally matches
 * frontend/src/mocks/workouts.json 1:1 so swapping the mock import for a
 * real GET /workouts call is a drop-in change with no visual diff.
 *
 * Run with: npm run prisma:seed
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PLANS = [
  {
    categoryKey: "WEIGHT_LOSS",
    title: "Weight Loss",
    description: "High-energy circuits to burn calories and improve stamina.",
    durationMinutes: 45,
    difficulty: "INTERMEDIATE",
    accentColor: "#2563EB",
    exercises: ["Jump Squats", "Mountain Climbers", "Burpees", "Lunges", "Plank"]
  },
  {
    categoryKey: "MUSCLE_GAIN",
    title: "Muscle Gain",
    description: "Structured strength blocks focused on hypertrophy and control.",
    durationMinutes: 60,
    difficulty: "ADVANCED",
    accentColor: "#06B6D4",
    exercises: ["Bench Press", "Deadlift", "Rows", "Shoulder Press", "Curls"]
  },
  {
    categoryKey: "STRENGTH",
    title: "Strength",
    description: "Progressive overload sessions for full-body power.",
    durationMinutes: 50,
    difficulty: "INTERMEDIATE",
    accentColor: "#22C55E",
    exercises: ["Squats", "Deadlift", "Push Press", "Pull-Ups", "Farmer Carry"]
  },
  {
    categoryKey: "CARDIO",
    title: "Cardio",
    description: "Heart-rate-boosting workouts with interval pacing.",
    durationMinutes: 35,
    difficulty: "BEGINNER",
    accentColor: "#F97316",
    exercises: ["Treadmill", "Cycling", "Rowing", "Jump Rope", "Sprint Finishers"]
  },
  {
    categoryKey: "YOGA",
    title: "Yoga",
    description: "Mobility, flexibility, and mindfulness flow sessions.",
    durationMinutes: 40,
    difficulty: "BEGINNER",
    accentColor: "#8B5CF6",
    exercises: ["Sun Salutation", "Warrior Flow", "Chair Pose", "Bridge", "Breathwork"]
  }
];

async function main() {
  for (const plan of PLANS) {
    const { exercises, ...planData } = plan;

    const existing = await prisma.workoutPlan.findFirst({ where: { title: plan.title } });
    if (existing) {
      console.log(`Skipping "${plan.title}" — already seeded`);
      continue;
    }

    const exerciseRecords = [];
    for (const name of exercises) {
      let exercise = await prisma.exercise.findFirst({ where: { name } });
      if (!exercise) {
        exercise = await prisma.exercise.create({ data: { name } });
      }
      exerciseRecords.push(exercise);
    }

    await prisma.workoutPlan.create({
      data: {
        ...planData,
        exercises: {
          create: exerciseRecords.map((e, idx) => ({ exerciseId: e.id, sortOrder: idx }))
        }
      }
    });

    console.log(`Seeded "${plan.title}" with ${exerciseRecords.length} exercises`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
