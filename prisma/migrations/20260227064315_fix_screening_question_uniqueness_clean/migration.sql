/*
  Warnings:

  - A unique constraint covering the columns `[source,question_key,country_code,language]` on the table `ScreeningQuestionDefinition` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[vendorId,source,question_key,country_code,language]` on the table `ScreeningQuestionDefinition` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ScreeningQuestionDefinition_question_key_country_code_langu_key";

-- DropIndex
DROP INDEX "ScreeningQuestionDefinition_vendorId_question_key_country_c_key";

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningQuestionDefinition_source_question_key_country_cod_key" ON "ScreeningQuestionDefinition"("source", "question_key", "country_code", "language");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningQuestionDefinition_vendorId_source_question_key_co_key" ON "ScreeningQuestionDefinition"("vendorId", "source", "question_key", "country_code", "language");
