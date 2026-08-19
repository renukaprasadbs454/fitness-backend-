-- CreateTable
CREATE TABLE "custom_workouts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER,
    "difficulty" "WorkoutDifficulty",
    "category_key" "WorkoutCategoryKey",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_workout_exercises" (
    "id" TEXT NOT NULL,
    "custom_workout_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscle_group" TEXT,
    "equipment" TEXT,
    "sets" INTEGER,
    "reps" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "custom_workout_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_workouts_user_id_idx" ON "custom_workouts"("user_id");

-- CreateIndex
CREATE INDEX "custom_workout_exercises_custom_workout_id_idx" ON "custom_workout_exercises"("custom_workout_id");

-- AddForeignKey
ALTER TABLE "custom_workouts" ADD CONSTRAINT "custom_workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_workout_exercises" ADD CONSTRAINT "custom_workout_exercises_custom_workout_id_fkey" FOREIGN KEY ("custom_workout_id") REFERENCES "custom_workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
