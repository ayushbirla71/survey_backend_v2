-- AlterTable
ALTER TABLE "SurveyVendorConfig" ADD COLUMN     "is_target_added" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendor_group_id" TEXT,
ADD COLUMN     "vendor_quota_id" TEXT;
