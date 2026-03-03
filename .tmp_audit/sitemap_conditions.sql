-- Total active
SELECT COUNT(*) AS total_active FROM "Job" WHERE "isExpired" = false;

-- Mirrors lib/jobs/queryJobs.ts buildHighSalaryEligibilityWhere() + buildGlobalExclusionsWhere()
SELECT COUNT(*) AS sitemap_jobs_current
FROM "Job"
WHERE "isExpired" = false
  AND "salaryValidated" = true
  AND COALESCE("salaryConfidence", 0) >= 80
  AND (
    (currency = 'USD' AND ("minAnnual" >= 100000 OR "maxAnnual" >= 100000)) OR
    (currency = 'GBP' AND ("minAnnual" >= 75000 OR "maxAnnual" >= 75000)) OR
    (currency = 'EUR' AND ("minAnnual" >= 80000 OR "maxAnnual" >= 80000)) OR
    (currency = 'CAD' AND ("minAnnual" >= 120000 OR "maxAnnual" >= 120000)) OR
    (currency = 'AUD' AND ("minAnnual" >= 140000 OR "maxAnnual" >= 140000)) OR
    (currency = 'CHF' AND ("minAnnual" >= 90000 OR "maxAnnual" >= 90000)) OR
    (currency = 'SGD' AND ("minAnnual" >= 130000 OR "maxAnnual" >= 130000)) OR
    (currency = 'NZD' AND ("minAnnual" >= 150000 OR "maxAnnual" >= 150000)) OR
    (currency = 'NOK' AND ("minAnnual" >= 1000000 OR "maxAnnual" >= 1000000)) OR
    (currency = 'SEK' AND ("minAnnual" >= 1000000 OR "maxAnnual" >= 1000000)) OR
    (currency = 'DKK' AND ("minAnnual" >= 700000 OR "maxAnnual" >= 700000))
  )
  AND NOT (
    "title" ILIKE '%intern%' OR
    "title" ILIKE '%internship%' OR
    "title" ILIKE '%junior%' OR
    "title" ILIKE '% jr%' OR
    "title" ILIKE '%jr.%' OR
    "title" ILIKE '%entry%' OR
    "title" ILIKE '%entry level%' OR
    "title" ILIKE '%graduate%' OR
    "title" ILIKE '%new grad%' OR
    "title" ILIKE '%new-gr%' OR
    "title" ILIKE '%(new grad%' OR
    "title" ILIKE '%new graduate%' OR
    "title" ILIKE '%phd graduate%' OR
    COALESCE("type", '') ILIKE '%part-time%' OR
    COALESCE("type", '') ILIKE '%part time%' OR
    COALESCE("type", '') ILIKE '%contract%' OR
    COALESCE("type", '') ILIKE '%temporary%' OR
    COALESCE("employmentType", '') ILIKE '%part-time%' OR
    COALESCE("employmentType", '') ILIKE '%part time%' OR
    COALESCE("employmentType", '') ILIKE '%contract%' OR
    COALESCE("employmentType", '') ILIKE '%temporary%'
  );

-- Same but WITHOUT the confidence gate (what we want the sitemap to become)
SELECT COUNT(*) AS sitemap_jobs_no_confidence
FROM "Job"
WHERE "isExpired" = false
  AND "salaryValidated" = true
  AND (
    (currency = 'USD' AND ("minAnnual" >= 100000 OR "maxAnnual" >= 100000)) OR
    (currency = 'GBP' AND ("minAnnual" >= 75000 OR "maxAnnual" >= 75000)) OR
    (currency = 'EUR' AND ("minAnnual" >= 80000 OR "maxAnnual" >= 80000)) OR
    (currency = 'CAD' AND ("minAnnual" >= 120000 OR "maxAnnual" >= 120000)) OR
    (currency = 'AUD' AND ("minAnnual" >= 140000 OR "maxAnnual" >= 140000)) OR
    (currency = 'CHF' AND ("minAnnual" >= 90000 OR "maxAnnual" >= 90000)) OR
    (currency = 'SGD' AND ("minAnnual" >= 130000 OR "maxAnnual" >= 130000)) OR
    (currency = 'NZD' AND ("minAnnual" >= 150000 OR "maxAnnual" >= 150000)) OR
    (currency = 'NOK' AND ("minAnnual" >= 1000000 OR "maxAnnual" >= 1000000)) OR
    (currency = 'SEK' AND ("minAnnual" >= 1000000 OR "maxAnnual" >= 1000000)) OR
    (currency = 'DKK' AND ("minAnnual" >= 700000 OR "maxAnnual" >= 700000))
  )
  AND NOT (
    "title" ILIKE '%intern%' OR
    "title" ILIKE '%internship%' OR
    "title" ILIKE '%junior%' OR
    "title" ILIKE '% jr%' OR
    "title" ILIKE '%jr.%' OR
    "title" ILIKE '%entry%' OR
    "title" ILIKE '%entry level%' OR
    "title" ILIKE '%graduate%' OR
    "title" ILIKE '%new grad%' OR
    "title" ILIKE '%new-gr%' OR
    "title" ILIKE '%(new grad%' OR
    "title" ILIKE '%new graduate%' OR
    "title" ILIKE '%phd graduate%' OR
    COALESCE("type", '') ILIKE '%part-time%' OR
    COALESCE("type", '') ILIKE '%part time%' OR
    COALESCE("type", '') ILIKE '%contract%' OR
    COALESCE("type", '') ILIKE '%temporary%' OR
    COALESCE("employmentType", '') ILIKE '%part-time%' OR
    COALESCE("employmentType", '') ILIKE '%part time%' OR
    COALESCE("employmentType", '') ILIKE '%contract%' OR
    COALESCE("employmentType", '') ILIKE '%temporary%'
  );
