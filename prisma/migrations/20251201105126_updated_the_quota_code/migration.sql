-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "ScreeningQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'DROPDOWN');

-- CreateEnum
CREATE TYPE "DisqualifyAction" AS ENUM ('TERMINATE', 'SKIP_TO_END', 'REDIRECT');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('PENDING', 'QUALIFIED', 'DISQUALIFIED', 'QUOTA_FULL');

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "disqualify_reason" TEXT,
ADD COLUMN     "qualification_status" "QualificationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "SurveyQuota" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "total_target" INTEGER,
    "termination_message" TEXT NOT NULL DEFAULT 'Thank you for your time, but you are not eligible for this survey.',
    "quota_full_message" TEXT NOT NULL DEFAULT 'Thank you for your interest, but we have already collected enough responses for your demographic.',
    "survey_complete_message" TEXT NOT NULL DEFAULT 'Thank you! The survey has been completed successfully.',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgeQuota" (
    "id" TEXT NOT NULL,
    "surveyQuotaId" TEXT NOT NULL,
    "age_from" INTEGER NOT NULL,
    "age_to" INTEGER NOT NULL,
    "target_count" INTEGER NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgeQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenderQuota" (
    "id" TEXT NOT NULL,
    "surveyQuotaId" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "target_count" INTEGER NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenderQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationQuota" (
    "id" TEXT NOT NULL,
    "surveyQuotaId" TEXT NOT NULL,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "target_count" INTEGER NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryQuota" (
    "id" TEXT NOT NULL,
    "surveyQuotaId" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "target_count" INTEGER NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningQuestion" (
    "id" TEXT NOT NULL,
    "surveyQuotaId" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" "ScreeningQuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "order_index" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "qualifying_answers" JSONB NOT NULL DEFAULT '[]',
    "disqualify_action" "DisqualifyAction" NOT NULL DEFAULT 'TERMINATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningOption" (
    "id" TEXT NOT NULL,
    "screeningQuestionId" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "option_value" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ScreeningOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningResponse" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "age" INTEGER,
    "gender" "Gender",
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "industry" TEXT,
    "is_qualified" BOOLEAN NOT NULL DEFAULT false,
    "disqualify_reason" TEXT,
    "screening_answers" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuota_surveyId_key" ON "SurveyQuota"("surveyId");

-- CreateIndex
CREATE INDEX "AgeQuota_surveyQuotaId_idx" ON "AgeQuota"("surveyQuotaId");

-- CreateIndex
CREATE INDEX "GenderQuota_surveyQuotaId_idx" ON "GenderQuota"("surveyQuotaId");

-- CreateIndex
CREATE INDEX "LocationQuota_surveyQuotaId_idx" ON "LocationQuota"("surveyQuotaId");

-- CreateIndex
CREATE INDEX "IndustryQuota_surveyQuotaId_idx" ON "IndustryQuota"("surveyQuotaId");

-- CreateIndex
CREATE INDEX "ScreeningQuestion_surveyQuotaId_idx" ON "ScreeningQuestion"("surveyQuotaId");

-- CreateIndex
CREATE INDEX "ScreeningOption_screeningQuestionId_idx" ON "ScreeningOption"("screeningQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningResponse_responseId_key" ON "ScreeningResponse"("responseId");

-- AddForeignKey
ALTER TABLE "SurveyQuota" ADD CONSTRAINT "SurveyQuota_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgeQuota" ADD CONSTRAINT "AgeQuota_surveyQuotaId_fkey" FOREIGN KEY ("surveyQuotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenderQuota" ADD CONSTRAINT "GenderQuota_surveyQuotaId_fkey" FOREIGN KEY ("surveyQuotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationQuota" ADD CONSTRAINT "LocationQuota_surveyQuotaId_fkey" FOREIGN KEY ("surveyQuotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryQuota" ADD CONSTRAINT "IndustryQuota_surveyQuotaId_fkey" FOREIGN KEY ("surveyQuotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningQuestion" ADD CONSTRAINT "ScreeningQuestion_surveyQuotaId_fkey" FOREIGN KEY ("surveyQuotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningOption" ADD CONSTRAINT "ScreeningOption_screeningQuestionId_fkey" FOREIGN KEY ("screeningQuestionId") REFERENCES "ScreeningQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningResponse" ADD CONSTRAINT "ScreeningResponse_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
