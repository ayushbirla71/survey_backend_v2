/*
  Warnings:

  - You are about to drop the column `age_from` on the `AgeQuota` table. All the data in the column will be lost.
  - You are about to drop the column `age_to` on the `AgeQuota` table. All the data in the column will be lost.
  - You are about to drop the column `disqualify_reason` on the `Response` table. All the data in the column will be lost.
  - You are about to drop the column `qualification_status` on the `Response` table. All the data in the column will be lost.
  - You are about to drop the column `quota_full_message` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the column `survey_complete_message` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the column `termination_message` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the `IndustryQuota` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ScreeningOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ScreeningQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ScreeningResponse` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[surveyQuotaId,gender]` on the table `GenderQuota` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `max_age` to the `AgeQuota` table without a default value. This is not possible if the table is not empty.
  - Added the required column `min_age` to the `AgeQuota` table without a default value. This is not possible if the table is not empty.
  - Made the column `total_target` on table `SurveyQuota` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "QuotaType" AS ENUM ('COUNT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "RespondentStatus" AS ENUM ('QUALIFIED', 'COMPLETED', 'TERMINATED', 'QUOTA_FULL');

-- DropForeignKey
ALTER TABLE "IndustryQuota" DROP CONSTRAINT "IndustryQuota_surveyQuotaId_fkey";

-- DropForeignKey
ALTER TABLE "ScreeningOption" DROP CONSTRAINT "ScreeningOption_screeningQuestionId_fkey";

-- DropForeignKey
ALTER TABLE "ScreeningQuestion" DROP CONSTRAINT "ScreeningQuestion_surveyQuotaId_fkey";

-- DropForeignKey
ALTER TABLE "ScreeningResponse" DROP CONSTRAINT "ScreeningResponse_responseId_fkey";

-- DropIndex
DROP INDEX "AgeQuota_surveyQuotaId_idx";

-- DropIndex
DROP INDEX "GenderQuota_surveyQuotaId_idx";

-- DropIndex
DROP INDEX "LocationQuota_surveyQuotaId_idx";

-- AlterTable
ALTER TABLE "AgeQuota" DROP COLUMN "age_from",
DROP COLUMN "age_to",
ADD COLUMN     "max_age" INTEGER NOT NULL,
ADD COLUMN     "min_age" INTEGER NOT NULL,
ADD COLUMN     "quota_type" "QuotaType" NOT NULL DEFAULT 'COUNT',
ADD COLUMN     "target_percentage" DOUBLE PRECISION,
ALTER COLUMN "target_count" DROP NOT NULL;

-- AlterTable
ALTER TABLE "GenderQuota" ADD COLUMN     "quota_type" "QuotaType" NOT NULL DEFAULT 'COUNT',
ADD COLUMN     "target_percentage" DOUBLE PRECISION,
ALTER COLUMN "target_count" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LocationQuota" ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "quota_type" "QuotaType" NOT NULL DEFAULT 'COUNT',
ADD COLUMN     "target_percentage" DOUBLE PRECISION,
ALTER COLUMN "target_count" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Response" DROP COLUMN "disqualify_reason",
DROP COLUMN "qualification_status";

-- AlterTable
ALTER TABLE "SurveyQuota" DROP COLUMN "quota_full_message",
DROP COLUMN "survey_complete_message",
DROP COLUMN "termination_message",
ADD COLUMN     "completed_url" TEXT,
ADD COLUMN     "quota_full_url" TEXT,
ADD COLUMN     "terminated_url" TEXT,
ADD COLUMN     "total_completed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_quota_full" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_terminated" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "total_target" SET NOT NULL;

-- DropTable
DROP TABLE "IndustryQuota";

-- DropTable
DROP TABLE "ScreeningOption";

-- DropTable
DROP TABLE "ScreeningQuestion";

-- DropTable
DROP TABLE "ScreeningResponse";

-- DropEnum
DROP TYPE "DisqualifyAction";

-- DropEnum
DROP TYPE "QualificationStatus";

-- DropEnum
DROP TYPE "ScreeningQuestionType";

-- CreateTable
CREATE TABLE "CategoryQuota" (
    "id" TEXT NOT NULL,
    "surveyQuotaId" TEXT NOT NULL,
    "surveyCategoryId" TEXT NOT NULL,
    "quota_type" "QuotaType" NOT NULL DEFAULT 'COUNT',
    "target_count" INTEGER,
    "target_percentage" DOUBLE PRECISION,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaRespondent" (
    "id" TEXT NOT NULL,
    "surveyQuotaId" TEXT NOT NULL,
    "vendor_respondent_id" TEXT,
    "age" INTEGER,
    "gender" "Gender",
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "surveyCategoryId" TEXT,
    "status" "RespondentStatus" NOT NULL DEFAULT 'QUALIFIED',
    "redirect_url_called" TEXT,
    "redirect_called_at" TIMESTAMP(3),
    "responseId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaRespondent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryQuota_surveyQuotaId_surveyCategoryId_key" ON "CategoryQuota"("surveyQuotaId", "surveyCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaRespondent_responseId_key" ON "QuotaRespondent"("responseId");

-- CreateIndex
CREATE INDEX "QuotaRespondent_surveyQuotaId_status_idx" ON "QuotaRespondent"("surveyQuotaId", "status");

-- CreateIndex
CREATE INDEX "QuotaRespondent_vendor_respondent_id_idx" ON "QuotaRespondent"("vendor_respondent_id");

-- CreateIndex
CREATE INDEX "AgeQuota_surveyQuotaId_min_age_max_age_idx" ON "AgeQuota"("surveyQuotaId", "min_age", "max_age");

-- CreateIndex
CREATE UNIQUE INDEX "GenderQuota_surveyQuotaId_gender_key" ON "GenderQuota"("surveyQuotaId", "gender");

-- CreateIndex
CREATE INDEX "LocationQuota_surveyQuotaId_country_state_city_idx" ON "LocationQuota"("surveyQuotaId", "country", "state", "city");

-- AddForeignKey
ALTER TABLE "CategoryQuota" ADD CONSTRAINT "CategoryQuota_surveyQuotaId_fkey" FOREIGN KEY ("surveyQuotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryQuota" ADD CONSTRAINT "CategoryQuota_surveyCategoryId_fkey" FOREIGN KEY ("surveyCategoryId") REFERENCES "SurveyCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaRespondent" ADD CONSTRAINT "QuotaRespondent_surveyQuotaId_fkey" FOREIGN KEY ("surveyQuotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
