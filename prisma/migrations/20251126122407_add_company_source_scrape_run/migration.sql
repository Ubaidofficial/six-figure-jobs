-- AlterTable
ALTER TABLE "JobSlice" ADD COLUMN "description" TEXT;
ALTER TABLE "JobSlice" ADD COLUMN "h1" TEXT;
ALTER TABLE "JobSlice" ADD COLUMN "title" TEXT;

-- CreateTable
CREATE TABLE "CompanySource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "atsProvider" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScrapedAt" DATETIME,
    "lastJobCount" INTEGER NOT NULL DEFAULT 0,
    "scrapeStatus" TEXT,
    "scrapeError" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanySource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "companiesTotal" INTEGER NOT NULL DEFAULT 0,
    "companiesScraped" INTEGER NOT NULL DEFAULT 0,
    "companiesFailed" INTEGER NOT NULL DEFAULT 0,
    "jobsFound" INTEGER NOT NULL DEFAULT 0,
    "jobsNew" INTEGER NOT NULL DEFAULT 0,
    "jobsUpdated" INTEGER NOT NULL DEFAULT 0,
    "jobsExpired" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "errorLog" TEXT,
    "triggerType" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "sizeBucket" TEXT,
    "tagsJson" TEXT,
    "fundingSummary" TEXT,
    "industry" TEXT,
    "atsProvider" TEXT,
    "atsUrl" TEXT,
    "atsSlug" TEXT,
    "lastScrapedAt" DATETIME,
    "scrapeStatus" TEXT,
    "scrapeError" TEXT,
    "jobCount" INTEGER NOT NULL DEFAULT 0,
    "countryCode" TEXT,
    "headquarters" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Company" ("atsProvider", "atsUrl", "countryCode", "createdAt", "description", "fundingSummary", "id", "logoUrl", "name", "sizeBucket", "slug", "tagsJson", "updatedAt", "website") SELECT "atsProvider", "atsUrl", "countryCode", "createdAt", "description", "fundingSummary", "id", "logoUrl", "name", "sizeBucket", "slug", "tagsJson", "updatedAt", "website" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
CREATE INDEX "Company_atsProvider_idx" ON "Company"("atsProvider");
CREATE INDEX "Company_scrapeStatus_idx" ON "Company"("scrapeStatus");
CREATE INDEX "Company_sizeBucket_idx" ON "Company"("sizeBucket");
CREATE INDEX "Company_industry_idx" ON "Company"("industry");
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
    CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("applyUrl", "benefitsJson", "city", "citySlug", "company", "companyId", "companyLogo", "countryCode", "createdAt", "currency", "descriptionHtml", "externalId", "id", "isExpired", "isHundredKLocal", "lastSeenAt", "locationId", "locationRaw", "maxAnnual", "minAnnual", "postedAt", "remote", "remoteMode", "remoteRegion", "requirementsJson", "roleSlug", "salaryCurrency", "salaryMax", "salaryMin", "salaryPeriod", "salaryRaw", "skillsJson", "source", "title", "type", "updatedAt", "url") SELECT "applyUrl", "benefitsJson", "city", "citySlug", "company", "companyId", "companyLogo", "countryCode", "createdAt", "currency", "descriptionHtml", "externalId", "id", "isExpired", "isHundredKLocal", "lastSeenAt", "locationId", "locationRaw", "maxAnnual", "minAnnual", "postedAt", "remote", "remoteMode", "remoteRegion", "requirementsJson", "roleSlug", "salaryCurrency", "salaryMax", "salaryMin", "salaryPeriod", "salaryRaw", "skillsJson", "source", "title", "type", "updatedAt", "url" FROM "Job";
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
CREATE UNIQUE INDEX "Job_externalId_source_key" ON "Job"("externalId", "source");
CREATE TABLE "new_RoleInference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "roleSlug" TEXT,
    "seniority" TEXT,
    "tagsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoleInference_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoleInference" ("createdAt", "id", "jobId", "roleSlug", "seniority", "tagsJson", "updatedAt") SELECT "createdAt", "id", "jobId", "roleSlug", "seniority", "tagsJson", "updatedAt" FROM "RoleInference";
DROP TABLE "RoleInference";
ALTER TABLE "new_RoleInference" RENAME TO "RoleInference";
CREATE UNIQUE INDEX "RoleInference_jobId_key" ON "RoleInference"("jobId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CompanySource_atsProvider_idx" ON "CompanySource"("atsProvider");

-- CreateIndex
CREATE INDEX "CompanySource_isActive_idx" ON "CompanySource"("isActive");

-- CreateIndex
CREATE INDEX "CompanySource_scrapeStatus_idx" ON "CompanySource"("scrapeStatus");

-- CreateIndex
CREATE INDEX "CompanySource_priority_idx" ON "CompanySource"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySource_companyId_url_key" ON "CompanySource"("companyId", "url");

-- CreateIndex
CREATE INDEX "ScrapeRun_status_idx" ON "ScrapeRun"("status");

-- CreateIndex
CREATE INDEX "ScrapeRun_startedAt_idx" ON "ScrapeRun"("startedAt");

-- CreateIndex
CREATE INDEX "JobSlice_jobCount_idx" ON "JobSlice"("jobCount");
