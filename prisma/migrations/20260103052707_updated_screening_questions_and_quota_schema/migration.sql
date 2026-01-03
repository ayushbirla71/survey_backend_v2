/*
  Warnings:

  - You are about to drop the column `completed_url` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the column `quota_full_url` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the column `terminated_url` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the column `total_completed` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the column `total_quota_full` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the column `total_target` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the column `total_terminated` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the `AgeQuota` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CategoryQuota` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GenderQuota` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LocationQuota` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `SurveyQuota` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DataType" AS ENUM ('STRING', 'NUMBER', 'ARRAY');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('VENDOR', 'SYSTEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "QuotaLogic" AS ENUM ('AND', 'OR');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('EQUALS', 'IN', 'NOT_IN', 'BETWEEN', 'GT', 'LT');

-- DropForeignKey
ALTER TABLE "AgeQuota" DROP CONSTRAINT "AgeQuota_surveyQuotaId_fkey";

-- DropForeignKey
ALTER TABLE "CategoryQuota" DROP CONSTRAINT "CategoryQuota_surveyCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "CategoryQuota" DROP CONSTRAINT "CategoryQuota_surveyQuotaId_fkey";

-- DropForeignKey
ALTER TABLE "GenderQuota" DROP CONSTRAINT "GenderQuota_surveyQuotaId_fkey";

-- DropForeignKey
ALTER TABLE "LocationQuota" DROP CONSTRAINT "LocationQuota_surveyQuotaId_fkey";

-- AlterTable
ALTER TABLE "SurveyQuota" DROP COLUMN "completed_url",
DROP COLUMN "quota_full_url",
DROP COLUMN "terminated_url",
DROP COLUMN "total_completed",
DROP COLUMN "total_quota_full",
DROP COLUMN "total_target",
DROP COLUMN "total_terminated",
ADD COLUMN     "current_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "logic" "QuotaLogic" NOT NULL DEFAULT 'AND',
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "target_count" INTEGER,
ADD COLUMN     "target_percentage" DOUBLE PRECISION;

-- DropTable
DROP TABLE "AgeQuota";

-- DropTable
DROP TABLE "CategoryQuota";

-- DropTable
DROP TABLE "GenderQuota";

-- DropTable
DROP TABLE "LocationQuota";

-- CreateTable
CREATE TABLE "ScreeningQuestionDefinition" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL DEFAULT 'IN',
    "language" TEXT NOT NULL DEFAULT 'ENGLISH',
    "question_key" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "data_type" "DataType" NOT NULL,
    "source" "QuestionSource" NOT NULL,
    "vendorId" TEXT,
    "vendor_question_id" TEXT,
    "primary_vendor_category_id" TEXT,
    "primary_vendor_category_name" TEXT,
    "categories_meta" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningQuestionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenQuestionOption" (
    "id" TEXT NOT NULL,
    "screeningQuestionId" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "vendor_option_id" TEXT,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "ScreenQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestionConfig" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "screeningQuestionId" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_screening" BOOLEAN NOT NULL DEFAULT true,
    "terminate_on" JSONB,
    "qualify_on" JSONB,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "SurveyQuestionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuotaCondition" (
    "id" TEXT NOT NULL,
    "quotaId" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "operator" "ConditionOperator" NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "SurveyQuotaCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningQuestionDefinition_question_key_key" ON "ScreeningQuestionDefinition"("question_key");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuestionConfig_surveyId_screeningQuestionId_key" ON "SurveyQuestionConfig"("surveyId", "screeningQuestionId");

-- AddForeignKey
ALTER TABLE "ScreenQuestionOption" ADD CONSTRAINT "ScreenQuestionOption_screeningQuestionId_fkey" FOREIGN KEY ("screeningQuestionId") REFERENCES "ScreeningQuestionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestionConfig" ADD CONSTRAINT "SurveyQuestionConfig_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestionConfig" ADD CONSTRAINT "SurveyQuestionConfig_screeningQuestionId_fkey" FOREIGN KEY ("screeningQuestionId") REFERENCES "ScreeningQuestionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuotaCondition" ADD CONSTRAINT "SurveyQuotaCondition_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
