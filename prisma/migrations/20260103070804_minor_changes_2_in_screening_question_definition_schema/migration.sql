/*
  Warnings:

  - A unique constraint covering the columns `[vendorId,question_key,country_code,language]` on the table `ScreeningQuestionDefinition` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ScreeningQuestionDefinition_vendorId_question_key_country_c_key" ON "ScreeningQuestionDefinition"("vendorId", "question_key", "country_code", "language");
