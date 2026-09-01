-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WORKOUT_ASSIGNED';

-- AlterTable
ALTER TABLE "custom_workouts" ADD COLUMN     "assigned_by_coach_id" TEXT;

-- CreateTable
CREATE TABLE "assigned_workout_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "note" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assigned_workout_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assigned_workout_plans_user_id_idx" ON "assigned_workout_plans"("user_id");

-- CreateIndex
CREATE INDEX "assigned_workout_plans_coach_id_idx" ON "assigned_workout_plans"("coach_id");

-- CreateIndex
CREATE INDEX "custom_workouts_assigned_by_coach_id_idx" ON "custom_workouts"("assigned_by_coach_id");

-- AddForeignKey
ALTER TABLE "custom_workouts" ADD CONSTRAINT "custom_workouts_assigned_by_coach_id_fkey" FOREIGN KEY ("assigned_by_coach_id") REFERENCES "coaches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_workout_plans" ADD CONSTRAINT "assigned_workout_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_workout_plans" ADD CONSTRAINT "assigned_workout_plans_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_workout_plans" ADD CONSTRAINT "assigned_workout_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
