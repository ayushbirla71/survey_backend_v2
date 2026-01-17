/*
  Warnings:

  - A unique constraint covering the columns `[question_key,country_code,language]` on the table `ScreeningQuestionDefinition` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ScreeningQuestionDefinition_question_key_key";

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningQuestionDefinition_question_key_country_code_langu_key" ON "ScreeningQuestionDefinition"("question_key", "country_code", "language");
