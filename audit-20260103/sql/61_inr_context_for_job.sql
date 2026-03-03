WITH s AS (
  SELECT "salaryRaw" as t
  FROM "Job"
  WHERE "id" = 'ats:greenhouse:7354759'
)
SELECT
  CASE WHEN POSITION('INR' IN t) > 0
    THEN SUBSTRING(t FROM GREATEST(POSITION('INR' IN t) - 160, 1) FOR 420)
    ELSE NULL
  END as inr_context
FROM s;
