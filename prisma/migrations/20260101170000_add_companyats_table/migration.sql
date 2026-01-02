-- Add CompanyATS table for board -> ATS discovery (RemoteOK/Remotive)

CREATE TABLE IF NOT EXISTS "CompanyATS" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "companySlug" TEXT NOT NULL,
  "atsType" TEXT NOT NULL,
  "atsUrl" TEXT NOT NULL,
  "discoveredBy" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastScraped" TIMESTAMP(3),
  "jobCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyATS_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyATS_companySlug_key" ON "CompanyATS" ("companySlug");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyATS_atsUrl_key" ON "CompanyATS" ("atsUrl");
CREATE INDEX IF NOT EXISTS "CompanyATS_atsType_idx" ON "CompanyATS" ("atsType");
CREATE INDEX IF NOT EXISTS "CompanyATS_isActive_idx" ON "CompanyATS" ("isActive");
CREATE INDEX IF NOT EXISTS "CompanyATS_lastScraped_idx" ON "CompanyATS" ("lastScraped");
