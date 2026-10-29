-- AlterEnum
ALTER TYPE "AdminAction" ADD VALUE 'ASSIGN_COACH';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assigned_coach_id" TEXT;

-- CreateIndex
CREATE INDEX "users_assigned_coach_id_idx" ON "users"("assigned_coach_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_coach_id_fkey" FOREIGN KEY ("assigned_coach_id") REFERENCES "coaches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
