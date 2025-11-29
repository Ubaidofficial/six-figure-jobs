-- AlterTable
ALTER TABLE "Company" ADD COLUMN "employeeCount" INTEGER;
ALTER TABLE "Company" ADD COLUMN "foundedYear" INTEGER;
ALTER TABLE "Company" ADD COLUMN "fundingStage" TEXT;

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
    "remoteMode" TEXT,
    "salaryRaw" TEXT,
    "descriptionHtml" TEXT,
    "salaryMin" BIGINT,
    "salaryMax" BIGINT,
    "salaryCurrency" TEXT,
    "salaryPeriod" TEXT,
    "minAnnual" BIGINT,
    "maxAnnual" BIGINT,
    "currency" TEXT,
    "isHighSalary" BOOLEAN NOT NULL DEFAULT false,
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
    "dedupeKey" TEXT,
    "sourcePriority" INTEGER NOT NULL DEFAULT 20,
    "isUnverifiedBoardJob" BOOLEAN NOT NULL DEFAULT false,
    "experienceLevel" TEXT DEFAULT 'mid',
    "employmentType" TEXT DEFAULT 'full-time',
    "workArrangement" TEXT,
    "visaSponsorship" BOOLEAN NOT NULL DEFAULT false,
    "techStack" TEXT,
    "industry" TEXT,
    "stateCode" TEXT,
    CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("applyUrl", "benefitsJson", "city", "citySlug", "company", "companyId", "companyLogo", "countryCode", "createdAt", "currency", "dedupeKey", "descriptionHtml", "externalId", "id", "isExpired", "isHighSalary", "isHundredKLocal", "isUnverifiedBoardJob", "lastSeenAt", "locationId", "locationRaw", "maxAnnual", "minAnnual", "postedAt", "remote", "remoteMode", "remoteRegion", "requirementsJson", "roleSlug", "salaryCurrency", "salaryMax", "salaryMin", "salaryPeriod", "salaryRaw", "skillsJson", "source", "sourcePriority", "title", "type", "updatedAt", "url") SELECT "applyUrl", "benefitsJson", "city", "citySlug", "company", "companyId", "companyLogo", "countryCode", "createdAt", "currency", "dedupeKey", "descriptionHtml", "externalId", "id", "isExpired", "isHighSalary", "isHundredKLocal", "isUnverifiedBoardJob", "lastSeenAt", "locationId", "locationRaw", "maxAnnual", "minAnnual", "postedAt", "remote", "remoteMode", "remoteRegion", "requirementsJson", "roleSlug", "salaryCurrency", "salaryMax", "salaryMin", "salaryPeriod", "salaryRaw", "skillsJson", "source", "sourcePriority", "title", "type", "updatedAt", "url" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_source_idx" ON "Job"("source");
CREATE INDEX "Job_roleSlug_idx" ON "Job"("roleSlug");
CREATE INDEX "Job_countryCode_idx" ON "Job"("countryCode");
CREATE INDEX "Job_isHighSalary_idx" ON "Job"("isHighSalary");
CREATE INDEX "Job_isHundredKLocal_idx" ON "Job"("isHundredKLocal");
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");
CREATE INDEX "Job_externalId_idx" ON "Job"("externalId");
CREATE INDEX "Job_remoteMode_idx" ON "Job"("remoteMode");
CREATE INDEX "Job_currency_idx" ON "Job"("currency");
CREATE INDEX "Job_isExpired_idx" ON "Job"("isExpired");
CREATE INDEX "Job_dedupeKey_idx" ON "Job"("dedupeKey");
CREATE INDEX "Job_experienceLevel_idx" ON "Job"("experienceLevel");
CREATE INDEX "Job_industry_idx" ON "Job"("industry");
CREATE INDEX "Job_workArrangement_idx" ON "Job"("workArrangement");
CREATE INDEX "Job_stateCode_idx" ON "Job"("stateCode");
CREATE UNIQUE INDEX "Job_externalId_source_key" ON "Job"("externalId", "source");
CREATE UNIQUE INDEX "Job_companyId_dedupeKey_key" ON "Job"("companyId", "dedupeKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Company_fundingStage_idx" ON "Company"("fundingStage");
