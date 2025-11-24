/*
  Warnings:

  - Added the required column `categoryId` to the `AIGeneratedQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AIGeneratedQuestion" ADD COLUMN     "categoryId" TEXT NOT NULL;
