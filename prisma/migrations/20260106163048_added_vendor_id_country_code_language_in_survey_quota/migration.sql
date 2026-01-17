-- AlterTable
ALTER TABLE "SurveyQuota" ADD COLUMN     "country_code" TEXT NOT NULL DEFAULT 'IN',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'ENGLISH',
ADD COLUMN     "vendorId" TEXT;
