-- AlterTable
ALTER TABLE "coaches" ADD COLUMN "is_head_coach" BOOLEAN NOT NULL DEFAULT false;

-- The demo "Main Coach" account is the head coach.
UPDATE "coaches" SET "is_head_coach" = true
WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" = 'coach@fitnerve.in');
