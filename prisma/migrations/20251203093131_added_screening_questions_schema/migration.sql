-- CreateEnum
CREATE TYPE "ScreeningQuestionType" AS ENUM ('AGE', 'GENDER', 'LOCATION', 'CATEGORY', 'CUSTOM');

-- CreateTable
CREATE TABLE "ScreeningQuestion" (
    "id" TEXT NOT NULL,
    "surveyQuotaId" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "type" "ScreeningQuestionType" NOT NULL,
    "question_text" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningQuestionOption" (
    "id" TEXT NOT NULL,
    "screeningQuestionId" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreeningQuestion_surveyQuotaId_type_idx" ON "ScreeningQuestion"("surveyQuotaId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningQuestion_surveyQuotaId_question_id_key" ON "ScreeningQuestion"("surveyQuotaId", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningQuestionOption_screeningQuestionId_option_id_key" ON "ScreeningQuestionOption"("screeningQuestionId", "option_id");

-- AddForeignKey
ALTER TABLE "ScreeningQuestion" ADD CONSTRAINT "ScreeningQuestion_surveyQuotaId_fkey" FOREIGN KEY ("surveyQuotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningQuestionOption" ADD CONSTRAINT "ScreeningQuestionOption_screeningQuestionId_fkey" FOREIGN KEY ("screeningQuestionId") REFERENCES "ScreeningQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
