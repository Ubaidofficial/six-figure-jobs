# Scraper Specification — Six Figure Jobs

Last Updated: December 20, 2025

## Overview
- 17 job board scrapers
- 247 ATS companies (Greenhouse, Lever, Ashby, Workday)
- 1,160 generic career page sources
- Total: 1,701 companies monitored

## Active Scrapers
1. RemoteOK
2. WeWorkRemotely
3. NoDesk
4. BuiltIn
5. Remote100k
6. RemoteRocketship
7. Himalayas (NEW)
8. RemoteLeaf (NEW)
9. RealWorkFromAnywhere
10. JustJoin
11. RemoteOtter
12. Trawle
13. FourDayWeek
14. Remotive
15. YCombinator
16. RemoteYeah (NEW - company discovery)
17. RemoteAI

## Error Handling Pattern
All scrapers use try-catch:
```typescript
try {
  // scraping logic
  return { created, skipped }
} catch (error) {
  return { created: 0, error: String(error) }
}
```

## Performance Targets
- Execution time: <30s per scraper
- Success rate: >90%
- Error rate: <5%

## Daily Scrape
```bash
npx tsx scripts/dailyScrapeV2.ts --mode=all
```
Runtime: 45-60 minutes

## Database Stats
```sql
SELECT COUNT(*) as total,
       COUNT(website) as with_website,
       COUNT("atsUrl") as with_ats
FROM "Company";
```
Current: 1,701 total, 1,407 websites, 247 ATS
