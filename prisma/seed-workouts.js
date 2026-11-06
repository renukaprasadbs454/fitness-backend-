/**
 * Seeds sample workout plans, exercises, and plan/exercise prescriptions.
 * Safe to run repeatedly: existing plans and exercises are reused, and only
 * missing plan links or prescription values are added.
 *
 * Run with: npm run prisma:seed:workouts
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const FITNESS_IMAGES = [
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80"
];

function sampleLinks(label, index) {
  const imageUrl = FITNESS_IMAGES[index % FITNESS_IMAGES.length];
  const videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${label} workout exercise tutorial`)}`;
  return { imageUrl, videoUrl };
}

const WORKOUTS = [
  {
    categoryKey: "WEIGHT_LOSS",
    title: "Weight Loss",
    description: "High-energy circuits to build stamina and support fat loss.",
    durationMinutes: 45,
    difficulty: "INTERMEDIATE",
    accentColor: "#2563EB",
    ...sampleLinks("Weight Loss", 0),
    exercises: [
      { name: "Jump Squats", muscleGroup: "Legs", equipment: "Bodyweight", sets: 3, reps: 12, caloriesPerRep: 0.32 },
      { name: "Mountain Climbers", muscleGroup: "Core", equipment: "Bodyweight", sets: 3, reps: 30, caloriesPerRep: 0.12 },
      { name: "Burpees", muscleGroup: "Full body", equipment: "Bodyweight", sets: 3, reps: 10, caloriesPerRep: 0.55 },
      { name: "Lunges", muscleGroup: "Legs", equipment: "Bodyweight", sets: 3, reps: 12, caloriesPerRep: 0.25 },
      { name: "Plank", muscleGroup: "Core", equipment: "Bodyweight", sets: 3, reps: 45, caloriesPerRep: 0.08 }
    ]
  },
  {
    categoryKey: "MUSCLE_GAIN",
    title: "Muscle Gain",
    description: "Progressive strength work focused on controlled hypertrophy.",
    durationMinutes: 60,
    difficulty: "ADVANCED",
    accentColor: "#06B6D4",
    ...sampleLinks("Muscle Gain", 1),
    exercises: [
      { name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell", sets: 4, reps: 8, caloriesPerRep: 0.4 },
      { name: "Deadlift", muscleGroup: "Back", equipment: "Barbell", sets: 4, reps: 6, caloriesPerRep: 0.6 },
      { name: "Rows", muscleGroup: "Back", equipment: "Dumbbell", sets: 4, reps: 10, caloriesPerRep: 0.3 },
      { name: "Shoulder Press", muscleGroup: "Shoulders", equipment: "Dumbbell", sets: 3, reps: 10, caloriesPerRep: 0.25 },
      { name: "Curls", muscleGroup: "Arms", equipment: "Dumbbell", sets: 3, reps: 12, caloriesPerRep: 0.18 }
    ]
  },
  {
    categoryKey: "STRENGTH",
    title: "Strength",
    description: "Compound lifts and progressive overload for full-body strength.",
    durationMinutes: 50,
    difficulty: "INTERMEDIATE",
    accentColor: "#22C55E",
    ...sampleLinks("Strength", 2),
    exercises: [
      { name: "Squats", muscleGroup: "Legs", equipment: "Barbell", sets: 4, reps: 6, caloriesPerRep: 0.35 },
      { name: "Deadlift", muscleGroup: "Back", equipment: "Barbell", sets: 3, reps: 5, caloriesPerRep: 0.6 },
      { name: "Push Press", muscleGroup: "Shoulders", equipment: "Barbell", sets: 3, reps: 8, caloriesPerRep: 0.35 },
      { name: "Pull-Ups", muscleGroup: "Back", equipment: "Pull-up bar", sets: 3, reps: 8, caloriesPerRep: 0.5 },
      { name: "Farmer Carry", muscleGroup: "Full body", equipment: "Dumbbells", sets: 3, reps: 30, caloriesPerRep: 0.15 }
    ]
  },
  {
    categoryKey: "CARDIO",
    title: "Cardio",
    description: "Beginner-friendly intervals to improve cardiovascular fitness.",
    durationMinutes: 35,
    difficulty: "BEGINNER",
    accentColor: "#F97316",
    ...sampleLinks("Cardio", 3),
    exercises: [
      { name: "Treadmill", muscleGroup: "Full body", equipment: "Treadmill", sets: 1, reps: 10, caloriesPerRep: 1.2 },
      { name: "Cycling", muscleGroup: "Legs", equipment: "Stationary bike", sets: 1, reps: 10, caloriesPerRep: 1 },
      { name: "Rowing", muscleGroup: "Full body", equipment: "Rowing machine", sets: 3, reps: 2, caloriesPerRep: 0.8 },
      { name: "Jump Rope", muscleGroup: "Full body", equipment: "Jump rope", sets: 3, reps: 60, caloriesPerRep: 0.15 },
      { name: "Sprint Finishers", muscleGroup: "Legs", equipment: "Treadmill or track", sets: 4, reps: 30, caloriesPerRep: 1.2 }
    ]
  },
  {
    categoryKey: "YOGA",
    title: "Yoga",
    description: "A gentle flow for mobility, balance, and mindful recovery.",
    durationMinutes: 40,
    difficulty: "BEGINNER",
    accentColor: "#8B5CF6",
    ...sampleLinks("Yoga", 4),
    exercises: [
      { name: "Sun Salutation", muscleGroup: "Full body", equipment: "Yoga mat", sets: 3, reps: 5, caloriesPerRep: 0.4 },
      { name: "Warrior Flow", muscleGroup: "Legs", equipment: "Yoga mat", sets: 2, reps: 6, caloriesPerRep: 0.3 },
      { name: "Chair Pose", muscleGroup: "Legs", equipment: "Yoga mat", sets: 3, reps: 30, caloriesPerRep: 0.08 },
      { name: "Bridge", muscleGroup: "Glutes", equipment: "Yoga mat", sets: 3, reps: 12, caloriesPerRep: 0.25 },
      { name: "Breathwork", muscleGroup: "Recovery", equipment: "None", sets: 1, reps: 5, caloriesPerRep: 0.1 }
    ]
  }
];

async function ensureExercise({ name, muscleGroup, equipment, sets, reps, caloriesPerRep }) {
  const links = sampleLinks(name, [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0));
  let exercise = await prisma.exercise.findFirst({ where: { name } });
  if (!exercise) {
    exercise = await prisma.exercise.create({
      data: {
        name,
        description: `${name} exercise included in the sample workout library.`,
        muscleGroup,
        equipment,
        caloriesPerRep,
        ...links
      }
    });
  } else {
    const missingDetails = {};
    if (!exercise.description) missingDetails.description = `${name} exercise included in the sample workout library.`;
    if (!exercise.muscleGroup) missingDetails.muscleGroup = muscleGroup;
    if (!exercise.equipment) missingDetails.equipment = equipment;
    if (!exercise.imageUrl) missingDetails.imageUrl = links.imageUrl;
    if (!exercise.videoUrl) missingDetails.videoUrl = links.videoUrl;
    if (exercise.caloriesPerRep == null) missingDetails.caloriesPerRep = caloriesPerRep;
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
    const missingLinks = {};
    if (!plan.imageUrl) missingLinks.imageUrl = planData.imageUrl;
    if (!plan.videoUrl) missingLinks.videoUrl = planData.videoUrl;
    if (Object.keys(missingLinks).length) {
      plan = await prisma.workoutPlan.update({ where: { id: plan.id }, data: missingLinks });
    }
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
