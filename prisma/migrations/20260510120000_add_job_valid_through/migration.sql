ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "validThrough" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "Job_validThrough_idx" ON "Job"("validThrough");

