/*
  Postgres-safe rewrite:
  - Add JobSlice SEO fields (description/title/h1) idempotently
  - Create CompanySource + ScrapeRun
  - Add Company meta columns with ALTER TABLE (no DROP/RENAME)
  - Add Job columns (descriptionHtml, isHighSalary, remoteMode, currency, externalId) with ALTER TABLE (no DROP/RENAME)
  - Ensure RoleInference FK delete cascade matches later behavior (skip redefine-table)
*/

-- JobSlice fields
ALTER TABLE "JobSlice" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "JobSlice" ADD COLUMN IF NOT EXISTS "h1" TEXT;
ALTER TABLE "JobSlice" ADD COLUMN IF NOT EXISTS "title" TEXT;

-- CompanySource
CREATE TABLE IF NOT EXISTS "CompanySource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "atsProvider" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastScrapedAt" timestamp(3),
  "lastJobCount" INTEGER NOT NULL DEFAULT 0,
  "scrapeStatus" TEXT,
  "scrapeError" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CompanySource_companyId_fkey'
  ) THEN
    ALTER TABLE "CompanySource"
      ADD CONSTRAINT "CompanySource_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ScrapeRun
CREATE TABLE IF NOT EXISTS "ScrapeRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "startedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" timestamp(3),
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

-- Company meta columns
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "sizeBucket" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "tagsJson" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "fundingSummary" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "atsSlug" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "lastScrapedAt" timestamp(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "scrapeStatus" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "scrapeError" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "jobCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "headquarters" TEXT;

-- Job fields
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "remoteMode" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "descriptionHtml" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "isHighSalary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

-- Add FKs if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Job_companyId_fkey') THEN
    ALTER TABLE "Job"
      ADD CONSTRAINT "Job_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Job_locationId_fkey') THEN
    ALTER TABLE "Job"
      ADD CONSTRAINT "Job_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "Location" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes (create if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Company_atsProvider_idx') THEN
    CREATE INDEX "Company_atsProvider_idx" ON "Company"("atsProvider");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Company_scrapeStatus_idx') THEN
    CREATE INDEX "Company_scrapeStatus_idx" ON "Company"("scrapeStatus");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Company_sizeBucket_idx') THEN
    CREATE INDEX "Company_sizeBucket_idx" ON "Company"("sizeBucket");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Company_industry_idx') THEN
    CREATE INDEX "Company_industry_idx" ON "Company"("industry");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CompanySource_atsProvider_idx') THEN
    CREATE INDEX "CompanySource_atsProvider_idx" ON "CompanySource"("atsProvider");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CompanySource_isActive_idx') THEN
    CREATE INDEX "CompanySource_isActive_idx" ON "CompanySource"("isActive");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CompanySource_scrapeStatus_idx') THEN
    CREATE INDEX "CompanySource_scrapeStatus_idx" ON "CompanySource"("scrapeStatus");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CompanySource_priority_idx') THEN
    CREATE INDEX "CompanySource_priority_idx" ON "CompanySource"("priority");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CompanySource_companyId_url_key') THEN
    CREATE UNIQUE INDEX "CompanySource_companyId_url_key" ON "CompanySource"("companyId","url");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ScrapeRun_status_idx') THEN
    CREATE INDEX "ScrapeRun_status_idx" ON "ScrapeRun"("status");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ScrapeRun_startedAt_idx') THEN
    CREATE INDEX "ScrapeRun_startedAt_idx" ON "ScrapeRun"("startedAt");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Job_isHighSalary_idx') THEN
    CREATE INDEX "Job_isHighSalary_idx" ON "Job"("isHighSalary");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Job_remoteMode_idx') THEN
    CREATE INDEX "Job_remoteMode_idx" ON "Job"("remoteMode");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Job_currency_idx') THEN
    CREATE INDEX "Job_currency_idx" ON "Job"("currency");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Job_companyId_idx') THEN
    CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Job_externalId_source_key') THEN
    CREATE UNIQUE INDEX "Job_externalId_source_key" ON "Job"("externalId","source");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'JobSlice_jobCount_idx') THEN
    CREATE INDEX "JobSlice_jobCount_idx" ON "JobSlice"("jobCount");
  END IF;
END $$;
