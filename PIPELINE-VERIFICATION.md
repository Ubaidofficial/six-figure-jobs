# Pipeline Integration Verification Checklist

## ✅ Current Pipeline (Correct Architecture)
```
GitHub Actions (cron: 6am, 6pm UTC)
    ↓
Railway: POST /api/cron/scrape
    ↓
app/api/cron/scrape/route.ts orchestrates:
    ↓
    1. dailyScrapeV2.ts (scrapes boards + ATS)
    ↓
    2. enrich-apply-urls.ts (extracts direct apply links)
    ↓
    3. aiEnrichStrategic.ts (AI enrichment for top jobs)
    ↓
    4. repair-location-v2.10.ts (location parsing)
```

## 📋 Verification Steps

### 1. Check Pipeline Route
```bash
cat app/api/cron/scrape/route.ts | grep "scripts/" 
```
Should show:
- ✅ scripts/dailyScrapeV2.ts
- ✅ scripts/enrich-apply-urls.ts
- ✅ scripts/aiEnrichStrategic.ts
- ✅ scripts/repair-location-v2.10.ts

### 2. Check GitHub Actions
```bash
cat .github/workflows/daily-scrape.yml | grep "cron\|api/cron"
```
Should show:
- ✅ cron: "0 6,18 * * *" (6am, 6pm UTC)
- ✅ POST to /api/cron/scrape?mode=all

### 3. Verify Scripts Exist
```bash
ls -la scripts/{dailyScrapeV2,enrich-apply-urls,aiEnrichStrategic,repair-location-v2.10}.ts
```

### 4. Test Individual Scripts
```bash
# Test strategic AI enrichment
TOP_N=5 MAX_TOTAL=10 npx tsx scripts/aiEnrichStrategic.ts

# Test location parsing
DRY_RUN=0 TAKE=100 npx tsx scripts/repair-location-v2.10.ts
```

## 🎯 What Each Component Does

### dailyScrapeV2.ts
- Runs all board scrapers (RemoteOK, WeWorkRemotely, etc.)
- Runs all ATS scrapers (Greenhouse, Lever, Ashby)
- Handles concurrency and error recovery
- **Does NOT run enrichments** (correct design)

### app/api/cron/scrape/route.ts
- Orchestrates the full pipeline
- Runs scraping first, then enrichments
- Handles process spawning and error logging
- **This is where the pipeline is defined**

### enrich-apply-urls.ts
- Extracts direct apply URLs from job board pages
- Uses Puppeteer to scrape actual job pages
- Saves direct ATS links (Greenhouse, Lever, etc.)

### aiEnrichStrategic.ts (NEW)
- Enriches top 30-50 jobs per category
- Uses DeepSeek API for cost efficiency
- Generates aiOneLiner, aiSnippet, aiSummaryJson
- **Strategic**: Only premium jobs ($100k+)

### repair-location-v2.10.ts (NOW AUTOMATED)
- Parses locationRaw into structured data
- Sets remote, remoteMode, remoteRegion
- Idempotent (won't re-process fixed jobs)

## ✅ Current Status

- [x] dailyScrapeV2.ts - Running in production
- [x] enrich-apply-urls.ts - Running in production
- [x] aiEnrichStrategic.ts - **NEWLY ADDED** ✨
- [x] repair-location-v2.10.ts - **NEWLY ADDED** ✨
- [x] Pipeline orchestration - **UPDATED** ✨

## 🚀 Ready to Deploy

All components are integrated and tested. Ready to commit and push to production.
```bash
git add app/api/cron/scrape/route.ts scripts/aiEnrichStrategic.ts
git commit -m "Add strategic AI enrichment and location parsing to scraping pipeline"
git push origin develop
```
