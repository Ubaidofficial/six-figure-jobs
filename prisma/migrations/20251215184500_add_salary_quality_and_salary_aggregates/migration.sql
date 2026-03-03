-- v2.9 Salary quality fields + SalaryAggregate table (additive, non-breaking)

ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "salaryConfidence" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "salaryValidated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "salarySource" TEXT,
  ADD COLUMN IF NOT EXISTS "salaryParseReason" TEXT,
  ADD COLUMN IF NOT EXISTS "salaryNormalizedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "salaryRejectedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "salaryRejectedReason" TEXT;

CREATE INDEX IF NOT EXISTS "Job_salaryValidated_idx" ON "Job" ("salaryValidated");
CREATE INDEX IF NOT EXISTS "Job_salaryConfidence_idx" ON "Job" ("salaryConfidence");
CREATE INDEX IF NOT EXISTS "Job_salarySource_idx" ON "Job" ("salarySource");
CREATE INDEX IF NOT EXISTS "Job_salaryNormalizedAt_idx" ON "Job" ("salaryNormalizedAt");

CREATE TABLE IF NOT EXISTS "SalaryAggregate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sliceType" TEXT NOT NULL,
  "sliceSlug" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "minConfidence" INTEGER NOT NULL DEFAULT 80,

  "jobCount" INTEGER NOT NULL DEFAULT 0,
  "minAnnual" BIGINT,
  "maxAnnual" BIGINT,
  "avgAnnual" BIGINT,
  "medianAnnual" BIGINT,
  "p75Annual" BIGINT,

  "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "slice_currency_unique" ON "SalaryAggregate" ("sliceType", "sliceSlug", "currency");
CREATE INDEX IF NOT EXISTS "SalaryAggregate_sliceType_idx" ON "SalaryAggregate" ("sliceType");
CREATE INDEX IF NOT EXISTS "SalaryAggregate_sliceSlug_idx" ON "SalaryAggregate" ("sliceSlug");
CREATE INDEX IF NOT EXISTS "SalaryAggregate_jobCount_idx" ON "SalaryAggregate" ("jobCount");

