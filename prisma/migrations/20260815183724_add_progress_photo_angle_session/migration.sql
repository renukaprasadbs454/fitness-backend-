-- CreateEnum
CREATE TYPE "PhotoAngle" AS ENUM ('FRONT', 'BACK', 'LEFT', 'RIGHT');

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "angle" "PhotoAngle",
ADD COLUMN     "session_id" TEXT;

-- CreateIndex
CREATE INDEX "media_user_id_type_session_id_idx" ON "media"("user_id", "type", "session_id");
