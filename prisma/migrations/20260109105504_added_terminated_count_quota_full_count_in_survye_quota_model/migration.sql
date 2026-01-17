-- AlterTable
ALTER TABLE "SurveyQuota" ADD COLUMN     "quota_full_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "terminated_count" INTEGER NOT NULL DEFAULT 0;
