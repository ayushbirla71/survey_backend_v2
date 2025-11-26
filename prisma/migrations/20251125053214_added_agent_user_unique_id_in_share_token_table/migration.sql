-- AlterEnum
ALTER TYPE "SurveySendBy" ADD VALUE 'AGENT';

-- AlterTable
ALTER TABLE "ShareToken" ADD COLUMN     "agentUserUniqueId" TEXT;
