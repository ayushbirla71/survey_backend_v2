-- DropForeignKey
ALTER TABLE "ScreenQuestionOption" DROP CONSTRAINT "ScreenQuestionOption_screeningQuestionId_fkey";

-- AddForeignKey
ALTER TABLE "ScreenQuestionOption" ADD CONSTRAINT "ScreenQuestionOption_screeningQuestionId_fkey" FOREIGN KEY ("screeningQuestionId") REFERENCES "ScreeningQuestionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
