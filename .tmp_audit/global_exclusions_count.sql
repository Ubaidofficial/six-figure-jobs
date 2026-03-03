SELECT
  COUNT(*) AS active_total,
  COUNT(*) FILTER (WHERE NOT (
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
  )) AS active_after_exclusions
FROM "Job"
WHERE "isExpired" = false;
