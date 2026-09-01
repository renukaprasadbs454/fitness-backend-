/*
  Warnings:

  - You are about to drop the column `coach_id` on the `assigned_workout_plans` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_by_coach_id` on the `custom_workouts` table. All the data in the column will be lost.
  - Added the required column `assigned_by_user_id` to the `assigned_workout_plans` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "assigned_workout_plans" DROP CONSTRAINT "assigned_workout_plans_coach_id_fkey";

-- DropForeignKey
ALTER TABLE "custom_workouts" DROP CONSTRAINT "custom_workouts_assigned_by_coach_id_fkey";

-- DropIndex
DROP INDEX "assigned_workout_plans_coach_id_idx";

-- DropIndex
DROP INDEX "custom_workouts_assigned_by_coach_id_idx";

-- AlterTable
ALTER TABLE "assigned_workout_plans" DROP COLUMN "coach_id",
ADD COLUMN     "assigned_by_user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "custom_workouts" DROP COLUMN "assigned_by_coach_id",
ADD COLUMN     "assigned_by_user_id" TEXT;

-- CreateIndex
CREATE INDEX "assigned_workout_plans_assigned_by_user_id_idx" ON "assigned_workout_plans"("assigned_by_user_id");

-- CreateIndex
CREATE INDEX "custom_workouts_assigned_by_user_id_idx" ON "custom_workouts"("assigned_by_user_id");

-- AddForeignKey
ALTER TABLE "custom_workouts" ADD CONSTRAINT "custom_workouts_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_workout_plans" ADD CONSTRAINT "assigned_workout_plans_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
