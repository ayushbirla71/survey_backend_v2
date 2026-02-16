-- DropForeignKey
ALTER TABLE "VendorQuestionLibrary" DROP CONSTRAINT "VendorQuestionLibrary_vendorId_fkey";

-- AddForeignKey
ALTER TABLE "ScreeningQuestionDefinition" ADD CONSTRAINT "ScreeningQuestionDefinition_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
