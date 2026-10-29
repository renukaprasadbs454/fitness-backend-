-- CreateEnum
CREATE TYPE "MeetingProvider" AS ENUM ('MANUAL', 'GOOGLE_MEET');

-- CreateEnum
CREATE TYPE "CoachReportReason" AS ENUM ('UNRESPONSIVE', 'MISSED_SESSIONS', 'UNPROFESSIONAL', 'NOT_A_GOOD_FIT', 'INAPPROPRIATE_BEHAVIOUR', 'OTHER');

-- CreateEnum
CREATE TYPE "CoachReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('GENERAL', 'ACCOUNT', 'PAYMENT', 'TECHNICAL', 'COACH', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "meeting_event_id" TEXT,
ADD COLUMN     "meeting_link" TEXT,
ADD COLUMN     "meeting_provider" "MeetingProvider";

-- CreateTable
CREATE TABLE "favorite_coaches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "reason" "CoachReportReason" NOT NULL,
    "details" TEXT,
    "wants_new_coach" BOOLEAN NOT NULL DEFAULT false,
    "status" "CoachReportStatus" NOT NULL DEFAULT 'OPEN',
    "admin_note" TEXT,
    "reassigned_to_coach_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'GENERAL',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "admin_reply" TEXT,
    "replied_by_id" TEXT,
    "replied_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_integrations" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "account_email" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "connected_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorite_coaches_coach_id_idx" ON "favorite_coaches"("coach_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_coaches_user_id_coach_id_key" ON "favorite_coaches"("user_id", "coach_id");

-- CreateIndex
CREATE INDEX "coach_reports_status_created_at_idx" ON "coach_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "coach_reports_coach_id_idx" ON "coach_reports"("coach_id");

-- CreateIndex
CREATE INDEX "coach_reports_user_id_idx" ON "coach_reports"("user_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_created_at_idx" ON "support_tickets"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_integrations_provider_key" ON "platform_integrations"("provider");

-- AddForeignKey
ALTER TABLE "favorite_coaches" ADD CONSTRAINT "favorite_coaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_coaches" ADD CONSTRAINT "favorite_coaches_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_reports" ADD CONSTRAINT "coach_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_reports" ADD CONSTRAINT "coach_reports_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

