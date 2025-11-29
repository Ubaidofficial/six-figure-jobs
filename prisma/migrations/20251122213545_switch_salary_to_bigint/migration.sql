/*
  Warnings:

  - You are about to alter the column `salaryMax` on the `Job` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `salaryMin` on the `Job` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to drop the column `description` on the `JobSlice` table. All the data in the column will be lost.
  - You are about to drop the column `lastComputedAt` on the `JobSlice` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `JobSlice` table. All the data in the column will be lost.
  - Made the column `filtersJson` on table `JobSlice` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "atsProvider" TEXT,
    "atsUrl" TEXT,
    "countryCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationRaw" TEXT NOT NULL,
    "city" TEXT,
    "citySlug" TEXT,
    "region" TEXT,
    "countryCode" TEXT,
    "isRemote" BOOLEAN DEFAULT false,
    "remoteRegion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RoleInference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "roleSlug" TEXT,
    "seniority" TEXT,
    "tagsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoleInference_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "companyLogo" TEXT,
    "locationRaw" TEXT,
    "city" TEXT,
    "citySlug" TEXT,
    "countryCode" TEXT,
    "remote" BOOLEAN,
    "remoteRegion" TEXT,
    "salaryRaw" TEXT,
    "salaryMin" BIGINT,
    "salaryMax" BIGINT,
    "salaryCurrency" TEXT,
    "salaryPeriod" TEXT,
    "minAnnual" BIGINT,
    "maxAnnual" BIGINT,
    "currency" TEXT,
    "isHundredKLocal" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "source" TEXT NOT NULL,
    "applyUrl" TEXT,
    "url" TEXT,
    "roleSlug" TEXT,
    "skillsJson" TEXT,
    "requirementsJson" TEXT,
    "benefitsJson" TEXT,
    "externalId" TEXT,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" DATETIME,
    "postedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "companyId" TEXT,
    "locationId" TEXT,
    CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("applyUrl", "benefitsJson", "city", "citySlug", "company", "companyLogo", "countryCode", "createdAt", "id", "isHundredKLocal", "locationRaw", "postedAt", "remote", "remoteRegion", "requirementsJson", "roleSlug", "salaryCurrency", "salaryMax", "salaryMin", "salaryPeriod", "salaryRaw", "skillsJson", "source", "title", "type", "updatedAt", "url") SELECT "applyUrl", "benefitsJson", "city", "citySlug", "company", "companyLogo", "countryCode", "createdAt", "id", "isHundredKLocal", "locationRaw", "postedAt", "remote", "remoteRegion", "requirementsJson", "roleSlug", "salaryCurrency", "salaryMax", "salaryMin", "salaryPeriod", "salaryRaw", "skillsJson", "source", "title", "type", "updatedAt", "url" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_source_idx" ON "Job"("source");
CREATE INDEX "Job_roleSlug_idx" ON "Job"("roleSlug");
CREATE INDEX "Job_countryCode_idx" ON "Job"("countryCode");
CREATE INDEX "Job_isHundredKLocal_idx" ON "Job"("isHundredKLocal");
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");
CREATE INDEX "Job_externalId_idx" ON "Job"("externalId");
CREATE UNIQUE INDEX "Job_externalId_source_key" ON "Job"("externalId", "source");
CREATE TABLE "new_JobSlice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filtersJson" TEXT NOT NULL,
    "jobCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_JobSlice" ("createdAt", "filtersJson", "id", "jobCount", "slug", "type", "updatedAt") SELECT "createdAt", "filtersJson", "id", "jobCount", "slug", "type", "updatedAt" FROM "JobSlice";
DROP TABLE "JobSlice";
ALTER TABLE "new_JobSlice" RENAME TO "JobSlice";
CREATE UNIQUE INDEX "JobSlice_slug_key" ON "JobSlice"("slug");
CREATE INDEX "JobSlice_type_idx" ON "JobSlice"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RoleInference_jobId_key" ON "RoleInference"("jobId");
