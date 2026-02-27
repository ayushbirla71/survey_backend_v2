-- AlterTable
ALTER TABLE "SurveyVendorConfig" ADD COLUMN     "is_cost_accepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quota_cost" INTEGER;
