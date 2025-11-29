/*
  Warnings:

  - A unique constraint covering the columns `[companyId,dedupeKey]` on the table `Job` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Company" ADD COLUMN "lastJobCountSyncAt" DATETIME;
ALTER TABLE "Company" ADD COLUMN "totalJobCount" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Job_companyId_dedupeKey_key" ON "Job"("companyId", "dedupeKey");
