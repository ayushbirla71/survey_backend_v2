/*
  Warnings:

  - Changed the type of `status` on the `SurveyVendorConfig` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "SurveyVendorConfig" DROP COLUMN "status",
ADD COLUMN     "status" "VendorSurveyStatus" NOT NULL;

-- CreateTable
CREATE TABLE "VendorQuestionLibrary" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "api_config_id" TEXT,
    "country_code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "vendor_question_id" TEXT,
    "metadata" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorQuestionLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "vendor_option_id" TEXT,
    "order_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorQuestionCategory" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "vendor_category_id" TEXT NOT NULL,
    "category_name" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorQuestionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorQuestionLibrary_vendorId_idx" ON "VendorQuestionLibrary"("vendorId");

-- CreateIndex
CREATE INDEX "VendorQuestionLibrary_country_code_language_idx" ON "VendorQuestionLibrary"("country_code", "language");

-- CreateIndex
CREATE INDEX "VendorQuestionLibrary_question_key_idx" ON "VendorQuestionLibrary"("question_key");

-- CreateIndex
CREATE INDEX "VendorQuestionLibrary_is_active_idx" ON "VendorQuestionLibrary"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "VendorQuestionLibrary_vendorId_question_key_country_code_la_key" ON "VendorQuestionLibrary"("vendorId", "question_key", "country_code", "language");

-- AddForeignKey
ALTER TABLE "VendorQuestionLibrary" ADD CONSTRAINT "VendorQuestionLibrary_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorQuestionLibrary" ADD CONSTRAINT "VendorQuestionLibrary_api_config_id_fkey" FOREIGN KEY ("api_config_id") REFERENCES "VendorApiConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorQuestionOption" ADD CONSTRAINT "VendorQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "VendorQuestionLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorQuestionCategory" ADD CONSTRAINT "VendorQuestionCategory_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "VendorQuestionLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
