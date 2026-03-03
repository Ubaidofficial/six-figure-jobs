# Audit Results - January 3, 2026

## Critical Issues Found
- `roleSlug` is NULL for `6,243/10,930` active jobs (57.1%); even high-salary validated subset has `3,408/5,928` NULL (57.5%).
- `sitemap-slices` publishes 0 URLs (both `priority` and `longtail` are empty) → no slice pages being indexed via sitemap.
- WeWorkRemotely: `27` active jobs have empty/missing `descriptionHtml` (all missing descriptions are from this source).
- Railway logs show repeated `duplicate key value violates unique constraint "Job_pkey"` errors during scraping (see `audit-20260103/railway-errors-lines.txt`).

## Warnings
- Daily job creation is spiky: `657` jobs added on `2026-01-03` vs `38` on `2026-01-02` (see `audit-20260103/jobs-added-last-7d.txt`).
- AI enrichment metadata incomplete: `aiModel` missing for `1,175/1,179` enriched jobs (see `audit-20260103/ai-model-nulls.txt`).
- Location fields are incomplete: `citySlug` present for 68.1%, `countryCode` for 49.0%, `stateCode` for 0% (see `audit-20260103/location-quality.txt`).

## Healthy Systems
- Core fields are present on active jobs: 0 missing title/company/url/applyUrl; only 27 missing descriptions (WWR) (see `audit-20260103/missing-critical-fields.txt`).
- Salary pipeline appears stable for “verified” jobs: `5,928` active `salaryValidated=true` (see `audit-20260103/homepage-claimed-vs-actual.txt`).
- Remote100k is not active in DB: `0` active jobs (see `audit-20260103/remote100k-active.txt`).

## Baseline Metrics
- Total active jobs: `10,930` (see `audit-20260103/baseline-counts.txt`)
- NULL `roleSlug`: `6,243` (57.1%) (see `audit-20260103/baseline-counts.txt`)
- High-salary jobs: `5,935` (validated: `5,928`) (see `audit-20260103/baseline-counts.txt`)
- AI enriched (`aiEnrichedAt` set): `1,179` (10.8%) (see `audit-20260103/ai-enrichment-status.txt`)
- Tech stack populated: `630` (5.8%) (see `audit-20260103/ai-enrichment-status.txt`)
- GSC indexed: manual check needed

## Audit #1: Scraper Health & Data Flow
- Jobs added (last 7 days): see `audit-20260103/jobs-added-last-7d.txt`
- Jobs by source (last 7 days): only Ashby + Greenhouse are contributing meaningful volume (see `audit-20260103/jobs-by-source-last-7d.txt`)
- Active jobs by source and NULL roleSlug rates:
  - `ats:greenhouse`: 10,307 active, 55.0% NULL roleSlug
  - `ats:ashby`: 559 active, 96.1% NULL roleSlug
  - `board:weworkremotely`: 27 active, 81.5% NULL roleSlug
  - `board:remotive`: 21 active, 71.4% NULL roleSlug
  - `board:remoteok`: 16 active, 0% NULL roleSlug
  (see `audit-20260103/roleSlug-null-by-source-active.txt`)
- Pipeline totals: 181 companies, 5 sources (see `audit-20260103/pipeline-totals.txt`)
- Largest contributors with NULL roleSlug:
  - SpaceX: 1,195 active jobs, 712 NULL roleSlug
  - Stripe: 443 active jobs, 285 NULL roleSlug
  - Airwallex (Ashby): 404 active jobs, 390 NULL roleSlug
  (see `audit-20260103/company-ats-top30.txt`)

## Audit #2: AI Enrichment Pipeline
- Enrichment coverage (active): 10.8% enriched; tech stack 5.8% populated (see `audit-20260103/ai-enrichment-status.txt`)
- Enrichment targeting (last 30 days): Greenhouse 10% enriched, Ashby 20.9%, Remotive 81% (see `audit-20260103/ai-enrichment-by-source-30d.txt`)
- Model usage (last 7 days): `models_used` often reports 0 due to missing `aiModel` on most enriched jobs (see `audit-20260103/ai-enrichment-usage-7d.txt` and `audit-20260103/ai-model-nulls.txt`)

## Audit #3: Salary Validation & Filtering
- Salary completeness (active): avg confidence 91.7; validated 5,928 (see `audit-20260103/salary-quality.txt`)
- Salary by source: Greenhouse is the only large source and has 51.5% validated; other sources are 100% validated but tiny volume (see `audit-20260103/salary-by-source.txt`)
- PPP flags by currency: see `audit-20260103/ppp-by-currency.txt`

## Audit #4: Database Integrity
- Missing critical fields: 27 missing descriptions, all from WeWorkRemotely (see `audit-20260103/missing-critical-fields.txt` and `audit-20260103/missing-description-by-source.txt`)
- Location completeness: see `audit-20260103/location-quality.txt`
- Duplicate groups exist by (title + company + salary) (see `audit-20260103/duplicates-title-company-salary.txt`)

## Audit #5: Sitemap & URL Health
- `sitemap.xml` reachable and contains 10 sitemap entries (see `audit-20260103/sitemap.xml.head.txt`)
- `sitemap-jobs.xml` contains 1 shard; `sitemap-jobs/1` contains `5,340` URLs (see `audit-20260103/sitemap-jobs.xml` and `audit-20260103/sitemap-jobs-1.urlcount.txt`)
- Other sitemaps URL counts:
  - Companies: 180 (`audit-20260103/sitemap-company.urlcount.txt`)
  - Browse: 422 (`audit-20260103/sitemap-browse.urlcount.txt`)
  - City: 19, Remote: 16, Category: 8, Country: 8, Level: 5, Salary: 4
- `sitemap-slices` exists but both sub-sitemaps are empty (`audit-20260103/sitemap-slices-priority.xml`, `audit-20260103/sitemap-slices-longtail.xml`)

## Audit #6: Publishing Strategy Status
- GSC phase/indexing: manual check needed
- PublishLog table: does not exist in DB (`audit-20260103/publishlog-last-7d.txt.err`)

## Audit #7: Performance & Infrastructure
- DB size: ~432 MB (see `audit-20260103/db-size.txt`)
- Largest tables: `Job` ~174 MB, `Job_Backup_2025_12_25` ~130 MB (see `audit-20260103/table-sizes.txt`)
- Key indexes exist: `roleSlug`, `isExpired`, `salaryValidated` (see `audit-20260103/job-indexes.txt`)

## Audit #8: Homepage Data Accuracy
- DB counts: total active jobs 10,930; verified (salaryValidated) jobs 5,928; unique companies 181 (see `audit-20260103/homepage-claimed-vs-actual.txt`)
- Top companies list: see `audit-20260103/top-companies-top20.txt`

## Audit #9: Error Logs Analysis
- Railway error patterns: repeated PK collisions on Job inserts (see `audit-20260103/railway-errors-lines.txt`)
- Recent commits (last 7 days): see `git log --oneline --since='7 days ago'`

## Competitor Benchmark (Manual)
- TBD

## Recommendations
- Proceed with the `roleSlug` backfill/fallback fix (this audit confirms NULL roleSlug is the dominant data-quality issue).
- Decide whether job boards with missing descriptions (WWR) should be excluded from sitemap/indexing until fixed.
- Investigate Job PK collision errors in Railway logs (likely ingestion attempting `create` vs `upsert` or duplicate scrape runs).
- If pSEO slices are intended, fix `sitemap-slices` generation (currently 0 URLs).
- Persist `aiModel` when saving enrichment (currently missing for 99.7% of enriched jobs).
- Run user-facing data-quality remediation before exposing more jobs:
  - Salary outliers (validated) exist across non-USD currencies (e.g., AUD maxAnnual up to 1,488,400; see `audit-20260103/salary-by-currency-validated.txt` and `audit-20260103/aud-outliers.txt`).
  - `applyUrl` has 6 non-HTTP values (all `mailto:` from Remotive); ensure UI handles `mailto:` safely (`audit-20260103/applyurl-non-http-samples.txt`).
  - `Job.companyLogo` is never populated (0%), but `Company.logoUrl` covers 55% of companies and 92.9% of active jobs via join (verify UI uses `companyRef.logoUrl`) (`audit-20260103/logo-coverage.txt`, `audit-20260103/jobs-with-company-logo-join.txt`).
  - Location parsing misses common `locationRaw` values (e.g., Dublin/Berlin/London/Hybrid) and 1,497 jobs have no city/country and are not remote (`audit-20260103/location-parsing-issues.txt`, `audit-20260103/location-completeness.txt`).

## Safe to Proceed?
- [ ] Yes, all systems healthy
- [x] Yes, with cautions (see critical issues/warnings)
- [ ] No, fix blockers first
