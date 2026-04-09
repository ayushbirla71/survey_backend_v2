/*
  Warnings:

  - The values [EQ,IN,GTE,LTE,INTERSECTS,REGEX] on the enum `QuotaOperator` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "QuotaOperator_new" AS ENUM ('BETWEEN', 'GREATER_THAN', 'LESS_THAN', 'EQUALS');
ALTER TABLE "SurveyQuotaBucket" ALTER COLUMN "operator" TYPE "QuotaOperator_new" USING ("operator"::text::"QuotaOperator_new");
ALTER TYPE "QuotaOperator" RENAME TO "QuotaOperator_old";
ALTER TYPE "QuotaOperator_new" RENAME TO "QuotaOperator";
DROP TYPE "QuotaOperator_old";
COMMIT;
