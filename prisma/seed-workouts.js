/**
 * Seeds sample workout plans, exercises, and plan/exercise prescriptions.
 * Safe to run repeatedly: existing plans and exercises are reused, and only
 * missing plan links or prescription values are added.
 *
 * Run with: npm run prisma:seed:workouts
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const WORKOUTS = [
  {
    categoryKey: "WEIGHT_LOSS",
    title: "Weight Loss",
    description: "High-energy circuits to build stamina and support fat loss.",
    durationMinutes: 45,
    difficulty: "INTERMEDIATE",
    accentColor: "#2563EB",
    exercises: [
      { name: "Jump Squats", muscleGroup: "Legs", equipment: "Bodyweight", sets: 3, reps: 12 },
      { name: "Mountain Climbers", muscleGroup: "Core", equipment: "Bodyweight", sets: 3, reps: 30 },
      { name: "Burpees", muscleGroup: "Full body", equipment: "Bodyweight", sets: 3, reps: 10 },
      { name: "Lunges", muscleGroup: "Legs", equipment: "Bodyweight", sets: 3, reps: 12 },
      { name: "Plank", muscleGroup: "Core", equipment: "Bodyweight", sets: 3, reps: 45 }
    ]
  },
  {
    categoryKey: "MUSCLE_GAIN",
    title: "Muscle Gain",
    description: "Progressive strength work focused on controlled hypertrophy.",
    durationMinutes: 60,
    difficulty: "ADVANCED",
    accentColor: "#06B6D4",
    exercises: [
      { name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell", sets: 4, reps: 8 },
      { name: "Deadlift", muscleGroup: "Back", equipment: "Barbell", sets: 4, reps: 6 },
      { name: "Rows", muscleGroup: "Back", equipment: "Dumbbell", sets: 4, reps: 10 },
      { name: "Shoulder Press", muscleGroup: "Shoulders", equipment: "Dumbbell", sets: 3, reps: 10 },
      { name: "Curls", muscleGroup: "Arms", equipment: "Dumbbell", sets: 3, reps: 12 }
    ]
  },
  {
    categoryKey: "STRENGTH",
    title: "Strength",
    description: "Compound lifts and progressive overload for full-body strength.",
    durationMinutes: 50,
    difficulty: "INTERMEDIATE",
    accentColor: "#22C55E",
    exercises: [
      { name: "Squats", muscleGroup: "Legs", equipment: "Barbell", sets: 4, reps: 6 },
      { name: "Deadlift", muscleGroup: "Back", equipment: "Barbell", sets: 3, reps: 5 },
      { name: "Push Press", muscleGroup: "Shoulders", equipment: "Barbell", sets: 3, reps: 8 },
      { name: "Pull-Ups", muscleGroup: "Back", equipment: "Pull-up bar", sets: 3, reps: 8 },
      { name: "Farmer Carry", muscleGroup: "Full body", equipment: "Dumbbells", sets: 3, reps: 30 }
    ]
  },
  {
    categoryKey: "CARDIO",
    title: "Cardio",
    description: "Beginner-friendly intervals to improve cardiovascular fitness.",
    durationMinutes: 35,
    difficulty: "BEGINNER",
    accentColor: "#F97316",
    exercises: [
      { name: "Treadmill", muscleGroup: "Full body", equipment: "Treadmill", sets: 1, reps: 10 },
      { name: "Cycling", muscleGroup: "Legs", equipment: "Stationary bike", sets: 1, reps: 10 },
      { name: "Rowing", muscleGroup: "Full body", equipment: "Rowing machine", sets: 3, reps: 2 },
      { name: "Jump Rope", muscleGroup: "Full body", equipment: "Jump rope", sets: 3, reps: 60 },
      { name: "Sprint Finishers", muscleGroup: "Legs", equipment: "Treadmill or track", sets: 4, reps: 30 }
    ]
  },
  {
    categoryKey: "YOGA",
    title: "Yoga",
    description: "A gentle flow for mobility, balance, and mindful recovery.",
    durationMinutes: 40,
    difficulty: "BEGINNER",
    accentColor: "#8B5CF6",
    exercises: [
      { name: "Sun Salutation", muscleGroup: "Full body", equipment: "Yoga mat", sets: 3, reps: 5 },
      { name: "Warrior Flow", muscleGroup: "Legs", equipment: "Yoga mat", sets: 2, reps: 6 },
      { name: "Chair Pose", muscleGroup: "Legs", equipment: "Yoga mat", sets: 3, reps: 30 },
      { name: "Bridge", muscleGroup: "Glutes", equipment: "Yoga mat", sets: 3, reps: 12 },
      { name: "Breathwork", muscleGroup: "Recovery", equipment: "None", sets: 1, reps: 5 }
    ]
  }
];

async function ensureExercise({ name, muscleGroup, equipment, sets, reps }) {
  let exercise = await prisma.exercise.findFirst({ where: { name } });
  if (!exercise) {
    exercise = await prisma.exercise.create({
      data: {
        name,
        description: `${name} exercise included in the sample workout library.`,
        muscleGroup,
        equipment
      }
    });
  } else {
    const missingDetails = {};
    if (!exercise.description) missingDetails.description = `${name} exercise included in the sample workout library.`;
    if (!exercise.muscleGroup) missingDetails.muscleGroup = muscleGroup;
    if (!exercise.equipment) missingDetails.equipment = equipment;
    if (Object.keys(missingDetails).length) {
      exercise = await prisma.exercise.update({ where: { id: exercise.id }, data: missingDetails });
    }
  }
  return { exercise, sets, reps };
}

async function seedWorkout(planConfig) {
  const { exercises, ...planData } = planConfig;
  let plan = await prisma.workoutPlan.findFirst({ where: { title: planData.title } });
  if (!plan) {
    plan = await prisma.workoutPlan.create({ data: planData });
    console.log(`Created workout plan: ${plan.title}`);
  } else {
    console.log(`Reusing workout plan: ${plan.title}`);
  }

  for (const [sortOrder, item] of exercises.entries()) {
    const { exercise, sets, reps } = await ensureExercise(item);
    const existingLink = await prisma.workoutPlanExercise.findUnique({
      where: { planId_exerciseId: { planId: plan.id, exerciseId: exercise.id } }
    });

    if (!existingLink) {
      await prisma.workoutPlanExercise.create({
        data: { planId: plan.id, exerciseId: exercise.id, sortOrder, sets, reps }
      });
      continue;
    }

    const missingPrescription = {};
    if (existingLink.sets == null) missingPrescription.sets = sets;
    if (existingLink.reps == null) missingPrescription.reps = reps;
    if (Object.keys(missingPrescription).length) {
      await prisma.workoutPlanExercise.update({
        where: { id: existingLink.id },
        data: missingPrescription
      });
    }
  }

  console.log(`Ensured ${exercises.length} exercise links for: ${plan.title}`);
}

async function main() {
  for (const workout of WORKOUTS) await seedWorkout(workout);
  console.log(`Workout seed complete (${WORKOUTS.length} plans).`);
}

main()
  .catch((error) => {
    console.error("Workout seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
