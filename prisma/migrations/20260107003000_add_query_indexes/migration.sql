-- Add composite indexes for common Job listing/filter queries (50k+ jobs target)

CREATE INDEX IF NOT EXISTS "Job_active_createdAt_idx"
ON "Job" ("isExpired", "createdAt");

CREATE INDEX IF NOT EXISTS "Job_active_updatedAt_id_idx"
ON "Job" ("isExpired", "updatedAt", "id");

CREATE INDEX IF NOT EXISTS "Job_role_salary_gate_idx"
ON "Job" ("roleSlug", "isExpired", "salaryValidated", "salaryConfidence");

CREATE INDEX IF NOT EXISTS "Job_country_salary_gate_idx"
ON "Job" ("countryCode", "isExpired", "salaryValidated", "salaryConfidence");

CREATE INDEX IF NOT EXISTS "Job_city_salary_gate_idx"
ON "Job" ("citySlug", "isExpired", "salaryValidated", "salaryConfidence");

CREATE INDEX IF NOT EXISTS "Job_remote_salary_gate_idx"
ON "Job" ("remoteMode", "remoteRegion", "isExpired", "salaryValidated", "salaryConfidence");

CREATE INDEX IF NOT EXISTS "Job_company_active_idx"
ON "Job" ("companyId", "isExpired");

CREATE INDEX IF NOT EXISTS "Job_aiEnrichedAt_idx"
ON "Job" ("aiEnrichedAt");

