-- AlterTable
ALTER TABLE "assigned_workout_plans" ADD COLUMN     "created_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "custom_workouts" ADD COLUMN     "created_by_user_id" TEXT;

-- CreateIndex
CREATE INDEX "assigned_workout_plans_created_by_user_id_idx" ON "assigned_workout_plans"("created_by_user_id");

-- CreateIndex
CREATE INDEX "custom_workouts_created_by_user_id_idx" ON "custom_workouts"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "custom_workouts" ADD CONSTRAINT "custom_workouts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_workout_plans" ADD CONSTRAINT "assigned_workout_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
