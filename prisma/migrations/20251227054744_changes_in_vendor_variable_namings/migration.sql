/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Vendor` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Vendor` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Vendor` table. All the data in the column will be lost.
  - You are about to drop the column `apiVersion` on the `VendorApiConfig` table. All the data in the column will be lost.
  - You are about to drop the column `authType` on the `VendorApiConfig` table. All the data in the column will be lost.
  - You are about to drop the column `baseUrl` on the `VendorApiConfig` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `VendorApiConfig` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `VendorApiConfig` table. All the data in the column will be lost.
  - You are about to drop the column `isDefault` on the `VendorApiConfig` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `VendorApiConfig` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[vendorId,api_version]` on the table `VendorApiConfig` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `Vendor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `api_version` to the `VendorApiConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `auth_type` to the `VendorApiConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `base_url` to the `VendorApiConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `VendorApiConfig` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "VendorApiConfig_vendorId_apiVersion_key";

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "createdAt",
DROP COLUMN "isActive",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "VendorApiConfig" DROP COLUMN "apiVersion",
DROP COLUMN "authType",
DROP COLUMN "baseUrl",
DROP COLUMN "createdAt",
DROP COLUMN "isActive",
DROP COLUMN "isDefault",
DROP COLUMN "updatedAt",
ADD COLUMN     "api_version" TEXT NOT NULL,
ADD COLUMN     "auth_type" "VendorAuthType" NOT NULL,
ADD COLUMN     "base_url" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VendorApiConfig_vendorId_api_version_key" ON "VendorApiConfig"("vendorId", "api_version");
