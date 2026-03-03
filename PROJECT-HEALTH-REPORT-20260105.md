# Six Figure Jobs — Comprehensive Health Report (2026-01-05)

This report combines **live DB metrics** (via `audit-health-20260105.md`) + **code/workflow review** + **live sitemap checks**.

## SUMMARY DASHBOARD

- Overall health score: **62 / 100**
- Jobs: **11,071 active** (`audit-health-20260105.md:7`), **6,044 salaryValidated** (`audit-health-20260105.md:23`)
- AI: **1,883 jobs enriched** (17.0% of active) (`audit-health-20260105.md:137`)
- Scrapers: **20 board scrapers** configured (`scripts/dailyScrapeV2.ts:99`), **472 ATS companies** configured (sum in `audit-health-20260105.md:140`)
- Sitemap: **10,273 total URL entries**; **9,609 job URLs** in `sitemap-jobs/1` (live fetch via `scripts/generate-sitemap.ts`)
- Costs (AI): last 7d **604,757 tokens** total, ~**504 tokens/job** (ledger only; see ⚠️ below) (`audit-health-20260105.md:178`)

---

## CRITICAL ISSUES (🔴)

### 1) Salary outliers present in active jobs (868 rows)
- Evidence: `audit-health-20260105.md:26` shows **868** active rows with `salaryMin/salaryMax/minAnnual/maxAnnual > 2,000,000`.
- Impact: breaks trust/UX, blocks validation, pollutes salary analytics, can leak into SEO if referenced.
- Likely cause: legacy writes or repair scripts populating `salaryMin/salaryMax` without v2.9 validation; ingest fallback parses arbitrary numbers from description (`lib/ingest/index.ts:654`).
- Recommended fix:
  - Run an outlier cleanup job (existing scripts: `scripts/clearCrazySalaries.ts`, `scripts/fixSalaryOutliers.ts`) and re-normalize.
  - Tighten “parse from descriptionHtml” fallback (gate by “salary keywords nearby”, not “any number”).

### 2) SEO sitemap includes many jobs that are not salary-validated
- Evidence:
  - Active jobs: **11,071** (`audit-health-20260105.md:7`), salaryValidated: **6,044** (`audit-health-20260105.md:23`)
  - Live sitemap jobs: **9,609** URLs (`scripts/generate-sitemap.ts` output)
  - Sitemap query does not apply high-salary eligibility, only excludes banned titles/types (`app/sitemap-jobs/[page]/route.ts:25`).
- Impact: dilutes “six-figure” topical authority; can index low-quality/incorrect-salary pages at scale.
- Recommended fix:
  - Add salary eligibility to job sitemap where clause (reuse `buildHighSalaryEligibilityWhere()` from `lib/jobs/queryJobs.ts:358`) or ensure non-eligible jobs are expired/noindexed.

### 3) Daily scraping workflow doesn’t verify pipeline completion
- Evidence:
  - GitHub Action only checks HTTP status of the trigger call (`.github/workflows/daily-scrape.yml:29`).
  - The endpoint returns immediately after spawning background processes (`app/api/cron/scrape/route.ts:107-112`) and does not block until completion.
- Impact: workflow can report “✅ success” even if scraping/enrichment fails later; no automated failure signal.
- Recommended fix:
  - Write a `ScrapeRun` row (already modeled in Prisma) at start/end and return `runId`, then poll status; or run scraping as a proper Railway cron job (not via request/child_process).

### 4) ATS failures can be silently marked “success”
- Evidence:
  - ATS runner swallows errors and returns `[]` (`lib/scrapers/ats/index.ts:27-50`).
  - Unsupported ATS providers also return `[]` (`lib/scrapers/ats/index.ts:43-46`).
  - `dailyScrapeV2` treats a successful call + `[]` jobs as success and updates `Company.scrapeStatus='success'` (`scripts/dailyScrapeV2.ts:198-214`).
- Impact: false “healthy ATS” signals; jobCount can drop to 0 without alerting; discovery scripts can set providers you don’t actually scrape.
- Recommended fix:
  - Return `{ jobs, error }` (or throw) so callers can mark `scrapeStatus='failed'` with a message.
  - Align provider enums: `lib/scrapers/ats/types.ts:3` vs `lib/scrapers/types.ts:3` (duplicate definitions + unsupported members).

---

## WARNINGS (🟡)

### 1) AI enrichment coverage + tech/skills coverage are low (but fixes are now in place)
- Evidence (active jobs):
  - Enriched: **1,883 / 11,071** (17.0%) (`audit-health-20260105.md:137`)
  - `techStack` present: **634 / 11,071** (5.7%) (`audit-health-20260105.md:143`)
  - `aiSummaryJson` “bullets-only” dominates historical data: **61.1%** (`audit-health-20260105.md:151`)
- Status: recently fixed strategic pipeline writes + prompt schema + longer snippet context.
- Risk: old “bullets-only” rows won’t be backfilled unless you re-enrich or add a targeted “fill missing aiSummaryJson keys” job.

### 2) AI cost tracking undercounts usage
- Evidence: `AiRunLedger` is written by `scripts/aiEnrichJobs.ts`, but the daily scrape pipeline runs `scripts/aiEnrichStrategic.ts` (no ledger writes).
- Impact: token totals and “$ / month” estimates can be materially wrong.
- Suggested fix: add ledger writes to `scripts/aiEnrichStrategic.ts` (same day-bucket logic as `scripts/aiEnrichJobs.ts:24`).

### 3) Canonical site URL logic is duplicated (risk of canonical mismatch)
- Evidence: `app/layout.tsx:16-18` uses `NEXT_PUBLIC_SITE_URL`, while canonical helper uses `RAILWAY_PUBLIC_DOMAIN` first (`lib/seo/site.ts:5-14`).
- Impact: incorrect `metadataBase`/canonical URLs if Railway domain env differs.
- Suggested fix: reuse `lib/seo/site.ts:getSiteUrl()` everywhere.

### 4) Hard-coded marketing counts in metadata
- Evidence: `app/layout.tsx:26-27` (“5,945+ jobs”, “333 companies”) is static.
- Impact: stale SERP descriptions + credibility hit.
- Suggested fix: replace with non-numeric copy, or generate periodically and inject at build time.

### 5) Dependency maintenance (no vulns, but several outdated)
- Evidence:
  - `npm audit --omit=dev`: **0 vulnerabilities**
  - `npm outdated`: Prisma and Next have newer versions available.
- Risk: missing performance/bugfixes; Prisma 7 is a major upgrade (plan carefully).

### 6) Query performance risks on high-traffic pages
- Evidence:
  - Listing queries do `count()` + `findMany()` per request (`lib/jobs/queryJobs.ts:55`).
  - Some filters use `contains` on `roleSlug` and JSON-string fields (`skillsJson`, `techStack`) which are not index-friendly (`lib/jobs/queryJobs.ts:205`, `lib/jobs/queryJobs.ts:320`).
- Impact: can become slow as the dataset grows and will not use indexes effectively.
- Suggested fix:
  - Prefer exact `roleSlug` match (no `contains`) and consider storing skills/tech as JSONB arrays with GIN indexes (or a join table).

### 7) Company table has many orphans + case-duplicate names
- Evidence:
  - Orphan companies (0 jobs): **1,857** (`audit-health-20260105.md` “Company Integrity” section)
  - Duplicate name groups (case-insensitive): examples include CircleCI/Consensys/GitLab (`audit-health-20260105.md` “Company Integrity” section)
- Impact: messy company UX, inconsistent branding/SEO, wasted crawl budget if company pages are generated.
- Suggested fix: run a dedupe/merge pass keyed by canonical domain + normalized name.

---

## INFORMATION (ℹ️)

- DB totals: **13,916 jobs** total; **11,071 active** (`audit-health-20260105.md:6-8`)
- Roles: top role is `software-engineer` (1,330 active) (`audit-health-20260105.md:53`)
- Sitemap health (live fetch):
  - `sitemap.xml` status 200, 9 sitemaps
  - job shard `sitemap-jobs/1`: **9,609 URLs**
  - browse sitemap: **406 URLs**
- Repo quality gates:
  - `npm run lint`: pass
  - `npm test`: pass (2 test suites passed, 1 skipped)

### Infra (not directly measurable from this repo)
- Railway resource usage / DB backups / deploy failures: requires Railway dashboard access (no in-repo telemetry).
- GitHub Actions success-rate over last 30 days: requires GitHub API access; workflows are present in `.github/workflows/` and schedules are configured in `.github/workflows/daily-scrape.yml:4-6`.

---

## NEXT ACTIONS (prioritized)

1) Fix salary outliers and re-normalize salaries (868 active outliers).
2) Make job sitemap “six-figure-only” (or explicitly noindex non-eligible jobs).
3) Add real pipeline run tracking + success/failure reporting (ScrapeRun table).
4) Make ATS scraping error-aware (stop reporting “success” for `[]`/unsupported).
5) Backfill AI structured fields for “bullets-only” rows created pre-fix.
