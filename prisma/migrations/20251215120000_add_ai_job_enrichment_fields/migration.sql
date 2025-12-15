-- v2.9 AI enrichment fields (additive, non-breaking)

ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "aiSummaryJson" JSONB,
  ADD COLUMN IF NOT EXISTS "aiSnippet" TEXT,
  ADD COLUMN IF NOT EXISTS "aiBenefits" JSONB,
  ADD COLUMN IF NOT EXISTS "aiRequirements" JSONB,
  ADD COLUMN IF NOT EXISTS "aiWhyHighPay" TEXT,
  ADD COLUMN IF NOT EXISTS "aiModel" TEXT,
  ADD COLUMN IF NOT EXISTS "aiVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "aiQualityScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastAiEnrichedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "Job_aiQualityScore_idx" ON "Job" ("aiQualityScore");
CREATE INDEX IF NOT EXISTS "Job_lastAiEnrichedAt_idx" ON "Job" ("lastAiEnrichedAt");
