SELECT
  "id",
  "source",
  "title",
  "company",
  "salaryRaw" IS NOT NULL as has_salary_raw,
  "salaryCurrency",
  "salaryPeriod",
  "salaryMin",
  "salaryMax",
  "minAnnual",
  "maxAnnual",
  "currency",
  "salaryValidated",
  "salaryConfidence",
  "salarySource",
  "salaryParseReason",
  "salaryRejectedReason"
FROM "Job"
WHERE "id" IN (
  'ats:greenhouse:6804253',
  'ats:greenhouse:7302982',
  'ats:greenhouse:7454771'
);
