SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'Job'
  AND (
    indexdef ILIKE '%roleSlug%'
    OR indexdef ILIKE '%isExpired%'
    OR indexdef ILIKE '%createdAt%'
    OR indexdef ILIKE '%salaryValidated%'
  )
ORDER BY indexname;
