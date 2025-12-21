# Changelog (Human)

This file is for human-curated release notes and noteworthy changes.

Rules:
- Small internal refactors can be omitted.
- Any SEO/indexation, scraper, schema, or user-facing UI change MUST be noted.

If you want auto-generated history, see CHANGELOG.generated.md.

## Unreleased

## [P0 Fixes & Scraper Expansion] - 2025-12-21

### UI & UX
- Fixed Jobs dropdown freeze and added emoji-enhanced nav labels (salary tiers + country flags).
- Removed “coming soon” footer items.
- Improved Companies page cards/grid and added emoji cues to job cards (📍 🌍 💰 🎁).

### SEO & Data Accuracy
- Homepage: switched to PPP-adjusted eligibility (`isHundredKLocal`) for latest jobs, corrected displayed counts (5,945 jobs / 333 companies), and reduced revalidate to 5 minutes.
- Country pages: show the correct local “six-figure” threshold label (e.g., Germany €80k+) in title/metadata and on-page copy.

### Scrapers
- Lever ATS: added retries + pagination + richer payload capture (full descriptions + raw) for AI enrichment.
- Ashby ATS: API-first via `posting-api` with strong debugging + fallbacks and full descriptions for enrichment.
- Remotive: expanded search terms/categories, removed ML-only filtering, preserved full descriptions, improved salary extraction, and passes descriptions into ingest.
- Added new board scrapers and wiring:
  - Dice (API-only, paginated) + runner `npm run scrape:dice`
  - Wellfound (GraphQL-only, paginated) + runner `npm run scrape:wellfound`
  - Otta (API → JSON → HTML fallback) + runner `npm run scrape:otta`
  - BuiltIn (Cheerio-only for 5 cities, paginated + rate-limited) + runner `npm run scrape:builtin`
- Daily scrape runner (`scripts/dailyScrapeV2.ts`) now includes Dice, Wellfound, and Otta; BuiltIn now uses the new TS scraper.

## [Scraper Optimization & UI Fixes] - 2025-12-20

### Critical Fixes ✅
- **AI Enrichment**: Filters by salary thresholds before enrichment
- **Error Handling**: Added try-catch to all scrapers
- **New Scrapers**: RemoteYeah, Himalayas, RemoteLeaf

### SEO & UX Improvements ✅
- **SEO**: Targeting "six figure jobs" keywords
- **Salary Labels**: Added "Minimum" context
- **Navigation**: Fixed dropdown (200ms delay)

### Coverage Stats
- 1,701 companies total (247 ATS + 1,160 generic)
- 17 board scrapers active

## [Scraper Optimization & UI Fixes] - 2025-12-20

### Critical Fixes ✅
- **AI Enrichment**: Now filters by salary thresholds before enrichment
  - Only processes jobs meeting $100k+ (or PPP equivalent)
  - Reduces token waste by ~70%

### Homepage & SEO Improvements ✅
- **SEO Keywords**: Updated to target "six figure jobs"
- **Salary Labels**: Added "Minimum" context to all displays

### Navigation & UX Fixes ✅
- **Dropdown Menu**: Fixed staying open (200ms delay)
- **Search Form**: Verified working

### Scraper Coverage Expansion ✅
- **Error Handling**: Added try-catch to all scrapers
- **New Scrapers**: RemoteYeah, Himalayas, RemoteLeaf
- **Coverage**: 1,701 companies (247 ATS + 1,160 generic)

- Security: redact leaked `CRON_SECRET` examples in docs.

## [Scraper Optimization & UI Fixes] - 2025-12-20

### Critical Fixes ✅
- **AI Enrichment**: Now filters by salary thresholds before enrichment
  - Only processes jobs meeting $100k+ (or PPP equivalent)
  - Reduces token waste by ~70%
  - Added salaryValidated check and currency-specific minimums

### Homepage & SEO Improvements ✅
- **SEO Keywords**: Updated title/description to target "six figure jobs"
  - Primary: "Six Figure Jobs - High Paying $100k+ Positions"
  - Added "six fig jobs", "6 figure jobs" throughout
- **Salary Labels**: Added "Minimum" context to all salary displays
  - Homepage hero: "Starting From" instead of "Min Salary"
  - Job cards: "Minimum: $XXk" prefix added
  - Remote page: "Minimum $100k+ USD" in title

### Navigation & UX Fixes ✅
- **Dropdown Menu**: Fixed Jobs menu staying open after mouse leave
  - Increased close delay to 200ms
  - Added cleanup in useEffect
  - onClick closes dropdown immediately
- **Search Form**: Verified homepage search submits correctly

### Scraper Coverage Expansion ✅
- **Error Handling**: Added try-catch to all 14 board scrapers
- **New Scrapers**: Added 3 new job board scrapers (RemoteYeah, Himalayas, RemoteLeaf)
- **Performance Logging**: Added execution time tracking
- **Generic Scraper**: Verified 1,160 company sources active

### Database Stats (as of Dec 20)
- Total companies: 1,701
- Companies with ATS: 247
- Generic sources active: 1,160
- Coverage improvement: +82% companies now scraped


## [Scraper Optimization & UI Fixes] - 2025-12-20

### Critical Fixes ✅
- **AI Enrichment**: Now filters by salary thresholds before enrichment
  - Only processes jobs meeting $100k+ (or PPP equivalent)
  - Reduces token waste by ~70%
  - Added salaryValidated check and currency-specific minimums

### Homepage & SEO Improvements ✅
- **SEO Keywords**: Updated title/description to target "six figure jobs"
  - Primary: "Six Figure Jobs - High Paying $100k+ Positions"
  - Added "six fig jobs", "6 figure jobs" throughout
- **Salary Labels**: Added "Minimum" context to all salary displays
  - Homepage hero: "Starting From" instead of "Min Salary"
  - Job cards: "Minimum: $XXk" prefix added
  - Remote page: "Minimum $100k+ USD" in title

### Navigation & UX Fixes ✅
- **Dropdown Menu**: Fixed Jobs menu staying open after mouse leave
  - Increased close delay to 200ms
  - Added cleanup in useEffect
  - onClick closes dropdown immediately
- **Search Form**: Verified homepage search submits correctly

### Scraper Coverage Expansion ✅
- **Error Handling**: Added try-catch to all 14 board scrapers
- **New Scrapers**: Added 3 new job board scrapers (RemoteYeah, Himalayas, RemoteLeaf)
- **Performance Logging**: Added execution time tracking
- **Generic Scraper**: Verified 1,160 company sources active

### Database Stats (as of Dec 20)
- Total companies: 1,701
- Companies with ATS: 247
- Generic sources active: 1,160
- Coverage improvement: +82% companies now scraped

- Security: require `Authorization: Bearer $CRON_SECRET` for `GET /api/scrape`.
- SEO: company sitemap excludes `noindex` companies (`jobCount < 3`).
- SEO: sitemap-browse emits canonical remote URLs (no redirect URLs).

## [P0 Fixes] - 2025-12-19

### PRD-1: Salary Integrity ✅
- Removed salary fabrication from RemoteOK scraper
- Removed salary fabrication from RemoteRocketship scraper
- Removed USD currency fallback from JustJoin scraper
- Added CI guardrail to prevent future salary fabrication

### PRD-2: Sitemap/Indexation Hygiene ✅
- Removed redirect URLs from sitemap-browse.xml
- Fixed soft-404 on invalid location slugs (now returns true 404)
- Added tier robots enforcement on /jobs/[role]
- Aligned slice seed/canonical country slugs
- Added /jobs/[...slug] route for slice pages
- Fixed company sitemap to exclude noindex companies (jobCount >= 3)

### PRD-3: Security Hardening ✅
- Protected /api/scrape with Bearer auth
- Switched /api/cron/ai-enrich to Authorization Bearer
- Removed leaked CRON_SECRET from docs/SEO_SPEC.md
- Removed leaked CRON_SECRET from lib/claude-rules-v2.6.md
- Added SSRF guard to generic scraper
- Rotated CRON_SECRET in Railway

### PRD-4: Salary Display Integrity ✅
- Removed fabricated `$100k` salary fallback in job cards
- Hide “VERIFIED SALARY” badge when salary is missing

### PRD-5: Slice Canonicalization Fixes ✅
- Slice BreadcrumbList JSON-LD uses canonical builder URLs
- Slice canonicalization redirects use `permanentRedirect` (308)
- Job page breadcrumb slice link uses canonical slice URL shape

### PRD-6: Internal Link Cleanup ✅
- Removed `/all-roles/` internal links in slice related links
- Homepage “Popular searches” links use canonical slice URLs

### PRD-7: Sitemap/Category Alignment ✅
- Category sitemap slugs aligned with category resolver (no invalid category URLs)
- Invalid category pages now return true 404 via `notFound()`

### UI/UX Phase 2 Deployed ✅
- **Homepage**: New hero section with enhanced search
- **Job Cards**: Improved layout and data density
- **Typography**: Refined font hierarchy
- **Color Scheme**: Updated brand colors
- **Mobile**: Enhanced responsive design

## [v2.10.0] - 2024-12-21

### Fixed
- **Global Query Logic**: Replaced 36 instances of USD-only queries with PPP-adjusted across all pages
- **Homepage Data**: Updated to accurate counts (5,945 jobs, 333 companies)
- **Germany Currency Display**: Shows €80k+, UK shows £75k+, etc. (was $100k everywhere)
- **Homepage Revalidation**: Reduced from 10min to 5min for faster updates
- **Metadata Accuracy**: All SEO metadata now reflects real counts

### Added
- **Emoji Icons**: 📍 🌍 💰 💼 🎁 throughout UI
- **Flag Emojis**: 🇺🇸 🇬🇧 🇩🇪 🇨🇦 🇦🇺 🇳🇱 in navigation
- **City Sitemap**: `/sitemap-city.xml` for 19 major cities

### Improved
- **Companies Page**: 4-column responsive grid with centered cards
- **Navigation**: Jobs dropdown with emojis + accurate thresholds

### Removed
- **Footer**: "Coming soon" placeholder links

### Technical
- **Core Web Vitals**: LCP/CLS/font fixes implemented
- **Job Schema**: Fixed `applicantLocationRequirements` for GSC
- **Redirects**: Salary pages now 301 (permanent)
