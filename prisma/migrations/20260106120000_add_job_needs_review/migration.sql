-- Add Job.needsReview manual review flag (salary sanity)

ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "needsReview" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Job_needsReview_idx" ON "Job" ("needsReview");
