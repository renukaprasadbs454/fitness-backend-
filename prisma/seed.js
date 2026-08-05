/**
 * Seeds the exercise library + workout plans so Phase 2 endpoints return
 * real data out of the box. Content intentionally matches
 * frontend/src/mocks/workouts.json 1:1 so swapping the mock import for a
 * real GET /workouts call is a drop-in change with no visual diff.
 *
 * Run with: npm run prisma:seed
 */
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../src/utils/password");
const prisma = new PrismaClient();

const COACHES = [
  {
    email: "rahul.coach@fitnerve.com",
    fullName: "Rahul Sharma",
    bio: "Certified strength & conditioning coach with 8 years helping clients build sustainable strength.",
    specialties: ["Strength Training", "Weight Loss"],
    experienceYears: 8,
    availability: [
      { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "17:00" },
      { dayOfWeek: "TUESDAY", startTime: "09:00", endTime: "17:00" },
      { dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "17:00" },
      { dayOfWeek: "THURSDAY", startTime: "09:00", endTime: "17:00" },
      { dayOfWeek: "FRIDAY", startTime: "09:00", endTime: "17:00" }
    ]
  },
  {
    email: "priya.coach@fitnerve.com",
    fullName: "Priya Kapoor",
    bio: "Nutrition-focused coach specializing in fat loss and sustainable habit building.",
    specialties: ["Nutrition Consultation", "Fat Loss"],
    experienceYears: 6,
    availability: [
      { dayOfWeek: "MONDAY", startTime: "10:00", endTime: "16:00" },
      { dayOfWeek: "WEDNESDAY", startTime: "10:00", endTime: "16:00" },
      { dayOfWeek: "FRIDAY", startTime: "10:00", endTime: "16:00" }
    ]
  },
  {
    email: "alex.coach@fitnerve.com",
    fullName: "Alex Morgan",
    bio: "Yoga and mobility specialist helping clients move better and recover faster.",
    specialties: ["Yoga", "Mobility", "Recovery"],
    experienceYears: 5,
    availability: [
      { dayOfWeek: "TUESDAY", startTime: "08:00", endTime: "14:00" },
      { dayOfWeek: "THURSDAY", startTime: "08:00", endTime: "14:00" },
      { dayOfWeek: "SATURDAY", startTime: "08:00", endTime: "14:00" }
    ]
  }
];

const CONTENT_CATEGORIES = [
  { name: "Training", slug: "training" },
  { name: "Nutrition", slug: "nutrition" },
  { name: "Mindset & Recovery", slug: "mindset-recovery" }
];

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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

async function seedWorkoutPlans() {
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

/** Returns { rahul, priya, alex } Coach records (creating them + their user + availability if missing). */
async function seedCoaches() {
  const coachRecords = {};

  for (const coach of COACHES) {
    let user = await prisma.user.findUnique({ where: { email: coach.email } });

    if (!user) {
      const passwordHash = await hashPassword("Coach@12345");
      user = await prisma.user.create({
        data: {
          email: coach.email,
          fullName: coach.fullName,
          passwordHash,
          role: "COACH",
          isEmailVerified: true
        }
      });
      await prisma.userProfile.create({ data: { userId: user.id } });
      console.log(`Seeded coach user "${coach.fullName}" (${coach.email} / Coach@12345)`);
    } else {
      console.log(`Skipping coach user "${coach.fullName}" — already seeded`);
    }

    let coachProfile = await prisma.coach.findUnique({ where: { userId: user.id } });
    if (!coachProfile) {
      coachProfile = await prisma.coach.create({
        data: {
          userId: user.id,
          bio: coach.bio,
          specialties: coach.specialties,
          experienceYears: coach.experienceYears,
          isAcceptingClients: true
        }
      });

      for (const slot of coach.availability) {
        await prisma.coachAvailability.create({
          data: { coachId: coachProfile.id, ...slot }
        });
      }
      console.log(`Seeded coach profile + ${coach.availability.length} availability slots for "${coach.fullName}"`);
    } else {
      console.log(`Skipping coach profile for "${coach.fullName}" — already seeded`);
    }

    coachRecords[coach.fullName] = coachProfile;
  }

  return coachRecords;
}

async function seedContent(coachRecords) {
  const categoryRecords = {};
  for (const category of CONTENT_CATEGORIES) {
    const existing = await prisma.contentCategory.findUnique({ where: { slug: category.slug } });
    categoryRecords[category.name] = existing ?? (await prisma.contentCategory.create({ data: category }));
  }

  const rahul = coachRecords["Rahul Sharma"];
  const priya = coachRecords["Priya Kapoor"];
  const alex = coachRecords["Alex Morgan"];

  const posts = [
    {
      type: "BLOG",
      title: "5 Strength Training Myths Debunked",
      summary: "Lifting heavy won't make you bulky overnight — and four other myths we hear every week.",
      body: "Strength training is one of the most misunderstood parts of fitness. In this post we break down the five most common myths — from \"lifting makes you bulky\" to \"cardio is better for fat loss\" — and explain what the research actually shows.",
      category: "Training",
      authorCoachId: rahul.userId
    },
    {
      type: "BLOG",
      title: "Why Sustainable Nutrition Beats Crash Diets",
      summary: "Small, repeatable habits outperform extreme diets every time. Here's why.",
      body: "Crash diets promise fast results but rarely last. This post covers a practical, sustainable approach to nutrition built around consistency rather than restriction — the same framework we use with one-on-one clients.",
      category: "Nutrition",
      authorCoachId: priya.userId
    },
    {
      type: "VIDEO",
      title: "10-Minute Morning Mobility Flow",
      summary: "A short mobility routine to loosen up before your day starts.",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      category: "Mindset & Recovery",
      authorCoachId: alex.userId
    },
    {
      type: "WORKOUT_TIP",
      title: "Warm Up Before Every Session",
      summary: "A proper warm-up cuts injury risk and improves performance in the first working set.",
      body: "Spend 5-10 minutes on dynamic movement before loading up — it primes the nervous system and raises joint temperature, both of which measurably improve performance and reduce injury risk.",
      category: "Training",
      authorCoachId: rahul.userId
    },
    {
      type: "NUTRITION_TIP",
      title: "Hydrate Before You're Thirsty",
      summary: "Thirst is a lagging indicator — by the time you feel it, performance has already dropped.",
      body: "Aim to sip water steadily throughout the day rather than relying on thirst as a signal. Even mild dehydration measurably reduces strength and endurance output.",
      category: "Nutrition",
      authorCoachId: priya.userId
    },
    {
      type: "WORKOUT_TIP",
      title: "Prioritize Recovery Days",
      summary: "Growth happens during recovery, not during the workout itself.",
      body: "Training breaks muscle down; recovery is what rebuilds it stronger. Skipping rest days consistently leads to plateaus and burnout — schedule them like you schedule training.",
      category: "Mindset & Recovery",
      authorCoachId: alex.userId
    }
  ];

  for (const post of posts) {
    const slug = slugify(post.title);
    const existing = await prisma.contentPost.findUnique({ where: { slug } });
    if (existing) {
      console.log(`Skipping content post "${post.title}" — already seeded`);
      continue;
    }

    await prisma.contentPost.create({
      data: {
        type: post.type,
        title: post.title,
        slug,
        summary: post.summary,
        body: post.body,
        videoUrl: post.videoUrl,
        status: "PUBLISHED",
        publishedAt: new Date(),
        categoryId: categoryRecords[post.category].id,
        authorId: post.authorCoachId
      }
    });
    console.log(`Seeded content post "${post.title}"`);
  }
}

async function main() {
  await seedWorkoutPlans();
  const coachRecords = await seedCoaches();
  await seedContent(coachRecords);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
