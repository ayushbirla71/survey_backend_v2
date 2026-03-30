/*
  Warnings:

  - A unique constraint covering the columns `[screeningQuestionId,vendor_option_id]` on the table `ScreenQuestionOption` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ScreenQuestionOption_screeningQuestionId_vendor_option_id_key" ON "ScreenQuestionOption"("screeningQuestionId", "vendor_option_id");
