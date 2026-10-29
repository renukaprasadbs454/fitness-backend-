-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminAction" ADD VALUE 'CREATE_PACKAGE';
ALTER TYPE "AdminAction" ADD VALUE 'UPDATE_PACKAGE';
ALTER TYPE "AdminAction" ADD VALUE 'DELETE_PACKAGE';
ALTER TYPE "AdminAction" ADD VALUE 'UPDATE_SUPPORT_TICKET';
ALTER TYPE "AdminAction" ADD VALUE 'UPDATE_COACH_REPORT';
ALTER TYPE "AdminAction" ADD VALUE 'CONNECT_INTEGRATION';
ALTER TYPE "AdminAction" ADD VALUE 'DISCONNECT_INTEGRATION';

