-- CreateEnum
CREATE TYPE "VendorKey" AS ENUM ('INNOVATEMR');

-- CreateEnum
CREATE TYPE "VendorAuthType" AS ENUM ('API_KEY', 'BASIC', 'OAUTH2', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VendorSurveyStatus" AS ENUM ('CREATED', 'LIVE', 'PAUSED', 'CLOSED');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "key" "VendorKey" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorApiConfig" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authType" "VendorAuthType" NOT NULL,
    "credentials" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorApiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyVendorConfig" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "api_config_id" TEXT NOT NULL,
    "vendor_survey_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyVendorConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_key_key" ON "Vendor"("key");

-- CreateIndex
CREATE UNIQUE INDEX "VendorApiConfig_vendorId_apiVersion_key" ON "VendorApiConfig"("vendorId", "apiVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyVendorConfig_surveyId_key" ON "SurveyVendorConfig"("surveyId");

-- AddForeignKey
ALTER TABLE "VendorApiConfig" ADD CONSTRAINT "VendorApiConfig_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyVendorConfig" ADD CONSTRAINT "SurveyVendorConfig_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyVendorConfig" ADD CONSTRAINT "SurveyVendorConfig_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyVendorConfig" ADD CONSTRAINT "SurveyVendorConfig_api_config_id_fkey" FOREIGN KEY ("api_config_id") REFERENCES "VendorApiConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
