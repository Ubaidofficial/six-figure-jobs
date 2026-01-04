SELECT
  "id",
  "company",
  "title",
  "countryCode",
  "citySlug",
  "locationRaw",
  "remote",
  "salaryCurrency",
  "currency"
FROM "Job"
WHERE "id" IN ('ats:greenhouse:6804253','ats:greenhouse:7302982','ats:greenhouse:7454771');
