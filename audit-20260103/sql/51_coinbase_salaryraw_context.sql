WITH s AS (
  SELECT
    "salaryRaw" as t
  FROM "Job"
  WHERE "id" = 'ats:greenhouse:6804253'
)
SELECT
  CASE WHEN POSITION('1,488,400' IN t) > 0
    THEN SUBSTRING(t FROM GREATEST(POSITION('1,488,400' IN t) - 120, 1) FOR 320)
    ELSE NULL
  END as context
FROM s;
