-- CreateEnum
CREATE TYPE "QuotaOperator" AS ENUM ('EQ', 'IN', 'BETWEEN', 'GTE', 'LTE', 'INTERSECTS', 'REGEX');

-- CreateTable
CREATE TABLE "SurveyQuotaBucket" (
    "id" TEXT NOT NULL,
    "quotaId" TEXT NOT NULL,
    "screeningQuestionId" TEXT NOT NULL,
    "label" TEXT,
    "operator" "QuotaOperator" NOT NULL,
    "value" JSONB NOT NULL,
    "target_count" INTEGER NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyQuotaBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyQuotaBucket_quotaId_screeningQuestionId_idx" ON "SurveyQuotaBucket"("quotaId", "screeningQuestionId");

-- AddForeignKey
ALTER TABLE "SurveyQuotaBucket" ADD CONSTRAINT "SurveyQuotaBucket_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "SurveyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuotaBucket" ADD CONSTRAINT "SurveyQuotaBucket_screeningQuestionId_fkey" FOREIGN KEY ("screeningQuestionId") REFERENCES "ScreeningQuestionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
