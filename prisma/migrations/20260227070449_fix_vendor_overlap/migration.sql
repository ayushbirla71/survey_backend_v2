/*
  Warnings:

  - A unique constraint covering the columns `[vendorId,question_key,country_code,language]` on the table `ScreeningQuestionDefinition` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ScreeningQuestionDefinition_vendorId_source_question_key_co_key";

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningQuestionDefinition_vendorId_question_key_country_c_key" ON "ScreeningQuestionDefinition"("vendorId", "question_key", "country_code", "language");
