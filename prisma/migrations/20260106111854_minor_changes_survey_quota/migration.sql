/*
  Warnings:

  - You are about to drop the column `logic` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `SurveyQuota` table. All the data in the column will be lost.
  - You are about to drop the `SurveyQuotaCondition` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SurveyQuotaCondition" DROP CONSTRAINT "SurveyQuotaCondition_quotaId_fkey";

-- AlterTable
ALTER TABLE "SurveyQuota" DROP COLUMN "logic",
DROP COLUMN "name";

-- DropTable
DROP TABLE "SurveyQuotaCondition";

-- DropEnum
DROP TYPE "ConditionOperator";

-- DropEnum
DROP TYPE "QuotaLogic";

-- CreateTable
CREATE TABLE "SurveyQuotaOption" (
    "id" TEXT NOT NULL,
    "quotaId" TEXT NOT NULL,
    "screeningQuestionId" TEXT NOT NULL,
    "screeningOptionId" TEXT NOT NULL,
    "target_count" INTEGER NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyQuotaOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuotaOption_quotaId_screeningQuestionId_screeningOpti_key" ON "SurveyQuotaOption"("quotaId", "screeningQuestionId", "screeningOptionId");

-- AddForeignKey
ALTER TABLE "SurveyQuotaOption" ADD CONSTRAINT "SurveyQuotaOption_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuotaOption" ADD CONSTRAINT "SurveyQuotaOption_screeningQuestionId_fkey" FOREIGN KEY ("screeningQuestionId") REFERENCES "ScreeningQuestionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuotaOption" ADD CONSTRAINT "SurveyQuotaOption_screeningOptionId_fkey" FOREIGN KEY ("screeningOptionId") REFERENCES "ScreenQuestionOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
