# Release Audit — v2.8 shortId rollout

Generated: 2025-12-14T19:41:14.634Z

Repo HEAD: `06b72de0a560789232890d6640a5a04e8c0522ea` (2025-12-14T18:26:57+01:00) — feat(jobs): permanent canonical redirects + shortId-backed job slugs

---

## Ship / No-Ship verdict

**NO-SHIP** (SEO + trust blockers remain). See “Final fix checklist”.

---

## Top 15 things done well

1. Centralized canonical job slug builder/parsing in `lib/jobs/jobSlug.ts` (v2.8 short slugs + legacy decode).
2. Job detail canonicalization implemented with `permanentRedirect()` in `app/job/[slug]/page.tsx`.
3. Rollout safety: DB-column existence check avoids pre-migration 500s in `app/job/[slug]/page.tsx`.
4. Ingest sets `Job.shortId` on create/upgrade/refresh using the same helper (`lib/ingest/index.ts`).
5. Backfill script exists with collision stop behavior (`scripts/backfill-shortId.ts`).
6. Remote role pages enforce canonical role slugs and tier gating (`app/remote/[role]/page.tsx`).
7. Dedicated sitemaps exist (jobs shards, remote, companies, browse, slices).
8. Middleware enforces apex→www and hard-disallows `/jobs/150k-plus` via 301 (`middleware.ts`).
9. JobPosting JSON-LD on job detail uses stable canonical URL (`lib/seo/jobJsonLd.ts`).
10. Search page is explicitly `noindex,follow` and canonicalizes query params (`app/search/page.tsx`).
11. Query boundary is mostly respected via `lib/jobs/queryJobs.ts`.
12. Many internal job links already use `buildJobSlugHref()` (job cards, remote pages, company page, sitemaps).
13. robots.txt blocks staging and AI crawlers from `/api/`.
14. Extensive operational scripts for ingest QA / cleanup exist under `scripts/`.
15. Prisma client singleton pattern avoids dev hot-reload explosion (`lib/prisma.ts`).

---

## Top 25 issues/risks (ranked)

### Blockers (must fix before ship)

1. **Non-canonical job URLs appear in JSON-LD on multiple listing pages** → canonical drift + Google Jobs issues.
   - Evidence: `app/jobs/[role]/page.tsx` ItemList uses job URLs like `/job/${job.id}`.
   - Also: `app/jobs/city/[city]/page.tsx`, `app/jobs/state/[state]/page.tsx`, `app/jobs/skills/[skill]/page.tsx`, `app/jobs/industry/[industry]/page.tsx`, `app/jobs/location/[country]/page.tsx`.
   - Fix: use `buildJobSlugHref(job)` / `buildJobSlug(job)` for JSON-LD URLs (or centralize via `lib/seo/structuredData.ts`).
   - Blast radius: Listings + structured data + canonical selection.

2. **Sitemap includes redirecting/non-canonical URLs**.
   - Evidence: `app/sitemap-browse.xml/route.ts` pushes `/jobs/location/remote`.
   - Evidence: `app/jobs/location/remote/route.ts` uses `redirect()` and points to `/remote/software-engineer`.
   - Fix: remove redirects from sitemap; only include canonical hubs.

3. **Slice sitemaps include thin pages (<10 jobs)** → violates “zero index bloat” rule.
   - Evidence: `app/sitemap-slices/longtail/route.ts` uses `jobCount: { gte: 5, lt: 20 }`.
   - Evidence: `app/sitemap-slices/priority/route.ts` includes `jobCount > 0` if recently updated.
   - Fix: enforce min jobCount for sitemap inclusion (>=10) and noindex under-threshold slice pages.

4. **Footer has broken legal/about links** → sitewide 404s, trust hit.
   - Evidence: `components/layout/Footer.tsx` links to `/about`, `/privacy`, `/terms`, `/cookies` but no routes exist.
   - Fix: add these routes (preferred) or remove links.

5. **Prisma migration strategy mismatch (sqlite migrations vs postgres schema)** → high drift risk.
   - Evidence: `prisma/migrations/migration_lock.toml` is sqlite while `prisma/schema.prisma` is postgresql.
   - Fix: baseline Postgres and migrate with `prisma migrate deploy` going forward.

### High

6. **Many canonicalization redirects still use temporary `redirect()` (307)**.
   - Evidence: `app/jobs/location/remote/route.ts`, `app/jobs/[role]/country/[country]/route.ts`, multiple alias pages.
   - Fix: use `permanentRedirect()` (or NextResponse.redirect(…,301)) for SEO canon.

7. **Indexation threshold too low on several pSEO pages**.
   - Evidence: city/state pages use `allowIndex = total >= 3`.
   - Fix: align to docs (min jobs for index + sitemap inclusion).

8. **Inconsistent SITE_URL derivation across routes**.
   - Evidence: several sitemap routes derive SITE_URL ad-hoc instead of `lib/seo/site.getSiteUrl()`.
   - Fix: standardize on `getSiteUrl()` and keep middleware canonical domain aligned.

9. **Deployment docs conflict (Railway vs VPS) + secrets in docs**.
   - Evidence: `docs/deployment/RAILWAY_DEPLOYMENT.md` vs `docs/deployment/README.md`/`SERVER_SETUP.md`.
   - Fix: pick authoritative infra doc set; move the other to `docs/archive`; remove secrets.

10. **Rollback plan references missing scripts**.
   - Evidence: `docs/ROLLBACK-PLAN.md` references `scripts/find-thin-pages.ts` etc (missing).

11. **QA tooling broken by Next 16 CLI changes**.
   - Evidence: `package.json` has `lint: next lint` but Next v16 has no lint command.

12. **Build-time DB coupling risks deploy reliability**.
   - Evidence: multiple ISR/SSG routes query Prisma; builds can fail if DB unreachable.

### Medium / Low

13. Duplicate Prisma clients (`lib/prisma.ts` vs `lib/db/client.js`).
14. Duplicate salary threshold logic (`lib/currency/thresholds.ts` vs `lib/jobs/salaryThresholds.ts` vs `lib/ingest/greenhouseSalaryParser.ts`).
15. Sitemap index uses BUILD_LASTMOD for all entries (docs explicitly call this out).
16. `docs/deployment/RAILWAY_DEPLOYMENT.md` is incomplete Markdown (unclosed fence).
17. Repo hygiene: `FETCH_HEAD` tracked.
18. Repo hygiene: `tsconfig.tsbuildinfo` tracked.
19. Some listing pages embed JobPosting objects in ItemList JSON-LD (Google Jobs duplication risk).
20. Company sitemap takes 50k records; risk for response size/perf.
21. Search canonicalization uses `redirect()` (temporary) (OK-ish, but inconsistent).
22. Some canonical URLs are hard-coded to https://www.6figjobs.com rather than `getSiteUrl()`.
23. Multiple legacy “audit” scripts/docs appear outdated (e.g. `audit-implementation.sh`).
24. Deployment docs include staging references while PROJECT_OS says no staging.
25. `lib/claude-rules-v2.6.md` duplicates SEO docs (non-authoritative).

---

## Repo map + route map + docs map

### Top-level

- .chatgpt-commands
- .chatgpt-rules
- .env.example
- .eslintrc.json
- .github
- .gitignore
- .vercelignore
- FETCH_HEAD
- TEST_DEPLOY.md
- app
- audit-implementation.sh
- components
- components.json
- docs
- hooks
- lib
- logs
- middleware.ts
- next-env.d.ts
- next.config.js
- package-lock.json
- package.json
- postcss.config.js
- prisma
- public
- remote100k-debug.png
- run-daily-scrape.sh
- scripts
- tailwind.config.js
- trigger.txt
- tsconfig.json
- tsconfig.tsbuildinfo

### Routes (app/)

- app/api/cron/scrape/route.ts
- app/api/scrape/route.ts
- app/companies/page.tsx
- app/company/[slug]/head.tsx
- app/company/[slug]/page.tsx
- app/company/page.tsx
- app/components/JobCard.tsx
- app/components/JobList.tsx
- app/components/RoleTypeahead.tsx
- app/globals.css
- app/job/[slug]/head.tsx
- app/job/[slug]/page.tsx
- app/jobs/100k-plus-jobs/page.tsx
- app/jobs/100k-plus/page.tsx
- app/jobs/150k-plus/page.tsx
- app/jobs/200k-plus-jobs/page.tsx
- app/jobs/200k-plus/page.tsx
- app/jobs/300k-plus-jobs/page.tsx
- app/jobs/300k-plus/page.tsx
- app/jobs/400k-plus-jobs/page.tsx
- app/jobs/400k-plus/page.tsx
- app/jobs/[...slug]/head.tsx
- app/jobs/[role]/[filter]/page.tsx
- app/jobs/[role]/city/[city]/page.tsx
- app/jobs/[role]/country/[country]/route.ts
- app/jobs/[role]/page.tsx
- app/jobs/[role]/remote/page.tsx
- app/jobs/[role]/skills/[skill]/page.tsx
- app/jobs/_components/SlicePage.tsx
- app/jobs/_components/page.tsx
- app/jobs/canada/page.tsx
- app/jobs/category/[category]/page.tsx
- app/jobs/city/[city]/page.tsx
- app/jobs/country/[code]/page.tsx
- app/jobs/germany/page.tsx
- app/jobs/industry/[industry]/page.tsx
- app/jobs/level/[level]/page.tsx
- app/jobs/location/[country]/page.tsx
- app/jobs/location/remote/route.ts
- app/jobs/page.tsx
- app/jobs/skills/[skill]/page.tsx
- app/jobs/skills/[skill]/remote/page.tsx
- app/jobs/state/[state]/page.tsx
- app/jobs/uk/page.tsx
- app/jobs/usa/page.tsx
- app/layout.tsx
- app/not-found.tsx
- app/page.tsx
- app/pageFAQ.tsx
- app/post-a-job/page.tsx
- app/pricing/page.tsx
- app/remote/[role]/[location]/page.tsx
- app/remote/[role]/city/[city]/page.tsx
- app/remote/[role]/country/[country]/page.tsx
- app/remote/[role]/page.tsx
- app/remote/page.tsx
- app/robots.txt/route.ts
- app/s/[slug]/page.tsx
- app/salary/[role]/[...loc]/page.tsx
- app/salary/[role]/page.tsx
- app/salary/page.tsx
- app/search/page.tsx
- app/sitemap-browse.xml/route.ts
- app/sitemap-category.xml/route.ts
- app/sitemap-company.xml/route.ts
- app/sitemap-country.xml/route.ts
- app/sitemap-jobs.xml/route.ts
- app/sitemap-jobs/[page]/route.ts
- app/sitemap-level.xml/route.ts
- app/sitemap-remote.xml/route.ts
- app/sitemap-salary.xml/route.ts
- app/sitemap-slices.xml/route.ts
- app/sitemap-slices/longtail/route.ts
- app/sitemap-slices/priority/route.ts
- app/sitemap.xml/route.ts
- app/test-shadcn/page.tsx

### Components/UI

- app/components/JobCard.tsx
- app/components/JobList.tsx
- app/components/RoleTypeahead.tsx
- app/jobs/_components/SlicePage.tsx
- app/jobs/_components/page.tsx
- components/jobs/JobCardSkeleton.tsx
- components/jobs/JobCardV2.tsx
- components/layout/Footer.tsx
- components/layout/MobileNav.tsx
- components/search/SearchInput.tsx
- components/theme-provider.tsx
- components/ui/avatar.tsx
- components/ui/badge.tsx
- components/ui/button.tsx
- components/ui/card.tsx
- components/ui/checkbox.tsx
- components/ui/dialog.tsx
- components/ui/dropdown-menu.tsx
- components/ui/input.tsx
- components/ui/select.tsx
- components/ui/separator.tsx
- components/ui/sheet.tsx
- components/ui/skeleton.tsx
- components/ui/slider.tsx
- components/ui/toast.tsx
- components/ui/toaster.tsx

### Libraries (lib/)

- lib/ai/jobAnnotator.ts
- lib/ai/openaiClient.ts
- lib/claude-rules-v2.6.md
- lib/companies/logo.ts
- lib/companies/upsertFromBoard.ts
- lib/constants/category-links.ts
- lib/constants/homepage.ts
- lib/currency/thresholds.ts
- lib/db/client.js
- lib/ingest/dedupeHelpers.ts
- lib/ingest/greenhouseSalaryParser.ts
- lib/ingest/index.ts
- lib/ingest/jobAgeFilter.ts
- lib/ingest/sourcePriority.ts
- lib/ingest/types.ts
- lib/jobs/expiry.ts
- lib/jobs/ingestBoardJob.ts
- lib/jobs/ingestFromAts.ts
- lib/jobs/jobSlug.ts
- lib/jobs/nlToFilters.ts
- lib/jobs/queryJobs.ts
- lib/jobs/salary.ts
- lib/jobs/salaryBands.ts
- lib/jobs/salaryThresholds.ts
- lib/jobs/searchSlug.ts
- lib/navigation/breadcrumbs.ts
- lib/navigation/internalLinks.ts
- lib/normalizers/ats.ts
- lib/normalizers/company.ts
- lib/normalizers/location.test.ts
- lib/normalizers/location.ts
- lib/normalizers/role.ts
- lib/normalizers/salary.ts
- lib/prisma.ts
- lib/roles/canonicalSlugs.ts
- lib/roles/salaryRoles.ts
- lib/roles/searchRoles.ts
- lib/roles/slugMatcher.ts
- lib/roles/synonyms.ts
- lib/salary/engine.ts
- lib/scrapers/_boardHelpers.ts
- lib/scrapers/ashby-companies.ts
- lib/scrapers/ashby.ts
- lib/scrapers/ats/[provider]/route.js
- lib/scrapers/ats/ashby.ts
- lib/scrapers/ats/greenhouse.ts
- lib/scrapers/ats/index.ts
- lib/scrapers/ats/lever.ts
- lib/scrapers/ats/route.js
- lib/scrapers/ats/types.ts
- lib/scrapers/ats/workday.ts
- lib/scrapers/base.ts
- lib/scrapers/builtin.js
- lib/scrapers/fixCorruptSalaries.ts
- lib/scrapers/fourdayweek.ts
- lib/scrapers/generic.ts
- lib/scrapers/greenhouse.ts
- lib/scrapers/helpers/salaryFlags.ts
- lib/scrapers/justjoin.ts
- lib/scrapers/lever-companies.ts
- lib/scrapers/nodesk.ts
- lib/scrapers/realworkfromanywhere.ts
- lib/scrapers/remote100k.ts
- lib/scrapers/remoteai.js
- lib/scrapers/remoteok.ts
- lib/scrapers/remoteotter.ts
- lib/scrapers/remoterocketship.ts
- lib/scrapers/remotive.ts
- lib/scrapers/trawle.ts
- lib/scrapers/types.ts
- lib/scrapers/weworkremotely.ts
- lib/scrapers/workday-companies.ts
- lib/scrapers/workday.ts
- lib/scrapers/ycombinator.ts
- lib/seo/canonical.ts
- lib/seo/company.ts
- lib/seo/companyJsonLd.ts
- lib/seo/companyMeta.ts
- lib/seo/countrySlug.ts
- lib/seo/jobJsonLd.ts
- lib/seo/jobMeta.ts
- lib/seo/meta.ts
- lib/seo/pseoTargets.ts
- lib/seo/regions.ts
- lib/seo/site.ts
- lib/seo/structuredData.ts
- lib/slices/builder.ts
- lib/slices/engine.ts
- lib/slices/loadSlice.ts
- lib/slices/rebuild.ts
- lib/slices/rebuild/route.js
- lib/slices/types.ts
- lib/types/ats.ts
- lib/utils.ts
- lib/utils/number.ts
- lib/utils/salaryLabels.ts
- lib/utils/time.ts

### Ingest/Scripts (scripts/)

- scripts/addMissingCompanies.ts
- scripts/addMoreCompanies.ts
- scripts/addRemoteCompanies.ts
- scripts/aiAnnotateJobs.ts
- scripts/analyzeRoles.ts
- scripts/auditCompanyMetrics.ts
- scripts/auditCurrencyLocationMismatches.ts
- scripts/auditSalary.ts
- scripts/auditSalary2.ts
- scripts/backfill-company-logos.ts
- scripts/backfill-high-salary-local.ts
- scripts/backfill-shortId.ts
- scripts/backfillAtsLogos.ts
- scripts/backfillCompanyLogos.ts
- scripts/backfillCompanyProfiles.ts
- scripts/backfillDedupeKeys.ts
- scripts/backfillJobLogos.ts
- scripts/backfillLinkedinHeuristics.ts
- scripts/backfillRemoteCountry.ts
- scripts/backfillSeoFields.ts
- scripts/bootstrapAllRoleSlices.ts
- scripts/bootstrapCountrySalarySlices.ts
- scripts/bootstrapHighSalarySlices.ts
- scripts/bootstrapRoleSalaryBands.ts
- scripts/bootstrapRoleSlices.ts
- scripts/checkAnthropicJob.ts
- scripts/checkAnthropicJobs.ts
- scripts/checkAnyDescriptions.ts
- scripts/checkCompanies.ts
- scripts/checkCompany.ts
- scripts/checkCompanyData.ts
- scripts/checkGreenhouseSalary.ts
- scripts/checkJobSources.ts
- scripts/checkMinSalary.ts
- scripts/checkRawJob.ts
- scripts/checkSalaries.ts
- scripts/checkSoftwareEngineerUS.ts
- scripts/cleanup-bad-companies.ts
- scripts/cleanup-non-canonical-role-slugs.ts
- scripts/cleanup404.ts
- scripts/cleanupRoleSlugs.ts
- scripts/clearCrazySalaries.ts
- scripts/createTestSlice.ts
- scripts/dailyScrape.ts
- scripts/dailyScrapeV2.ts
- scripts/debugDescriptions.ts
- scripts/debugSalaryRegex.ts
- scripts/debugSalaryRegex2.ts
- scripts/debugSalaryRegex3.ts
- scripts/debugSlices.ts
- scripts/debugUSJob.ts
- scripts/deepDiscovery.ts
- scripts/deleteAshbyJobs.ts
- scripts/deployment/deploy-production.sh
- scripts/deployment/start-staging.sh
- scripts/deployment/stop-staging.sh
- scripts/disableBadAtsCompanies.ts
- scripts/disableBadGreenhouseSlugs.ts
- scripts/discoverATS.ts
- scripts/discoverATSBulk.ts
- scripts/discoverATSSlugs.ts
- scripts/discoverCompanies.ts
- scripts/enrichAtsMetadata.ts
- scripts/extractGreenhouseSalaries.ts
- scripts/fetchCompanyDescriptions.ts
- scripts/fetchRemoteCompanies.ts
- scripts/findGreenhouseCompany.ts
- scripts/findSalaryInDesc.ts
- scripts/findSalaryInDesc2.ts
- scripts/fix-instacart-merge.ts
- scripts/fix-instacart.ts
- scripts/fixAllSalaries.ts
- scripts/fixAllSalariesV2.ts
- scripts/fixAndAddCompanies.ts
- scripts/fixBadCompanyNames.ts
- scripts/fixBadMin.ts
- scripts/fixCorruptSalaries.ts
- scripts/fixExact1M.ts
- scripts/fixGreenhouseSlugs.ts
- scripts/fixLeverSlugs.ts
- scripts/fixLocationNormalizer.ts
- scripts/fixMissingCompanySlugs.ts
- scripts/fixSalaryOutliers.ts
- scripts/fixUSSalaries.ts
- scripts/generateJobSlices.ts
- scripts/ingestBoards.ts
- scripts/mergeDuplicates.ts
- scripts/monitoring-dashboard.ts
- scripts/normalizeLocations.ts
- scripts/publish-pseo-batch.ts
- scripts/qa.ts
- scripts/qaSalaryCoverage.ts
- scripts/qaScrapers.ts
- scripts/rebuildRoleSlugs.ts
- scripts/repairCurrencyAndSalary.ts
- scripts/repairLocations.ts
- scripts/repairMinMaxSalary.ts
- scripts/reportAtsCoverage.ts
- scripts/reprocessAnthropicSalaries.ts
- scripts/researchJobBoards.ts
- scripts/resetDatabase.ts
- scripts/salarySanityCleanup.ts
- scripts/salarySanityCleanupV2.ts
- scripts/salarySanityCleanupV3.ts
- scripts/scrapeCareerPages.ts
- scripts/scrapeGitHub.ts
- scripts/scrapeMoreCompanies.ts
- scripts/scrapeNodeskCompanies.ts
- scripts/seed.ts
- scripts/seedJobSlices.ts
- scripts/seedTopCompanies.ts
- scripts/setTestJobSalary.ts
- scripts/smokeScrapers.ts
- scripts/testAtsScraper.ts
- scripts/testBoardScrapers.ts
- scripts/testDescriptionScrape.ts
- scripts/testLocationNormalizer.ts
- scripts/testLocationSamples.ts
- scripts/testRemote100k.ts
- scripts/testRemote100kIntegration.ts
- scripts/testWorkingGreenhouse.ts
- scripts/updateSalaryFlags.ts
- scripts/verifyAtsPipeline.ts
- scripts/verifyFix.ts

### Data (prisma/)

- prisma/migrations/20251122183203_init_jobs/migration.sql
- prisma/migrations/20251122213545_switch_salary_to_bigint/migration.sql
- prisma/migrations/20251124012311_add_company_description/migration.sql
- prisma/migrations/20251124153623_add_remote_mode_and_company_meta/migration.sql
- prisma/migrations/20251124163812_add_description_and_company_meta_fields/migration.sql
- prisma/migrations/20251126122407_add_company_source_scrape_run/migration.sql
- prisma/migrations/20251126184844_add_dedupe_fields/migration.sql
- prisma/migrations/20251127183928_phase4_company_trust_fields/migration.sql
- prisma/migrations/20251128144625_add_seo_fields/migration.sql
- prisma/migrations/migration_lock.toml
- prisma/schema.prisma
- prisma/seed-remote-companies.ts

### Public assets (public/)

- public/README-IMAGES.md
- public/llms.txt
- public/logo.png
- public/logo.svg
- public/og-image.png

### Docs/specs (docs/)

- docs/ARCHITECTURE_SPEC.md
- docs/DATA_INGEST_SPEC.md
- docs/DESIGN_UX_SPEC.md
- docs/PROJECT_OS.md
- docs/RELEASE_QA_SPEC.md
- docs/ROLLBACK-PLAN.md
- docs/SEO-IMPLEMENTATION-v1.5.md
- docs/SEO_SPEC.md
- docs/archive/SEO_IMPLEMENTATION_v1.5_2025-12-11_DEPRECATED.md.md
- docs/deployment/RAILWAY_DEPLOYMENT.md
- docs/deployment/README.md
- docs/deployment/SERVER_SETUP.md

### Config & root files

- .chatgpt-commands
- .chatgpt-rules
- .env.example
- .eslintrc.json
- .github/workflows/daily-scrape.yml
- .github/workflows/deploy.yml.disabled
- .github/workflows/scraper-staging.yml
- .gitignore
- .vercelignore
- FETCH_HEAD
- TEST_DEPLOY.md
- audit-implementation.sh
- components.json
- middleware.ts
- next-env.d.ts
- next.config.js
- package-lock.json
- package.json
- postcss.config.js
- remote100k-debug.png
- run-daily-scrape.sh
- tailwind.config.js
- trigger.txt
- tsconfig.json
- tsconfig.tsbuildinfo

### Other

- hooks/use-toast.ts
- hooks/useJobScraper.js
- logs/qa-2025-11-28.json
- logs/scrape-2025-11-28.json

### Route Map (App Router)

- app/api/cron/scrape/route.ts → `/api/cron/scrape`
- app/api/scrape/route.ts → `/api/scrape`
- app/companies/page.tsx → `/companies`
- app/company/[slug]/head.tsx → `/company/[slug]`
- app/company/[slug]/page.tsx → `/company/[slug]`
- app/company/page.tsx → `/company`
- app/job/[slug]/head.tsx → `/job/[slug]`
- app/job/[slug]/page.tsx → `/job/[slug]`
- app/jobs/100k-plus-jobs/page.tsx → `/jobs/100k-plus-jobs`
- app/jobs/100k-plus/page.tsx → `/jobs/100k-plus`
- app/jobs/150k-plus/page.tsx → `/jobs/150k-plus`
- app/jobs/200k-plus-jobs/page.tsx → `/jobs/200k-plus-jobs`
- app/jobs/200k-plus/page.tsx → `/jobs/200k-plus`
- app/jobs/300k-plus-jobs/page.tsx → `/jobs/300k-plus-jobs`
- app/jobs/300k-plus/page.tsx → `/jobs/300k-plus`
- app/jobs/400k-plus-jobs/page.tsx → `/jobs/400k-plus-jobs`
- app/jobs/400k-plus/page.tsx → `/jobs/400k-plus`
- app/jobs/[...slug]/head.tsx → `/jobs/[...slug]`
- app/jobs/[role]/[filter]/page.tsx → `/jobs/[role]/[filter]`
- app/jobs/[role]/city/[city]/page.tsx → `/jobs/[role]/city/[city]`
- app/jobs/[role]/country/[country]/route.ts → `/jobs/[role]/country/[country]`
- app/jobs/[role]/page.tsx → `/jobs/[role]`
- app/jobs/[role]/remote/page.tsx → `/jobs/[role]/remote`
- app/jobs/[role]/skills/[skill]/page.tsx → `/jobs/[role]/skills/[skill]`
- app/jobs/_components/page.tsx → `/jobs/_components`
- app/jobs/canada/page.tsx → `/jobs/canada`
- app/jobs/category/[category]/page.tsx → `/jobs/category/[category]`
- app/jobs/city/[city]/page.tsx → `/jobs/city/[city]`
- app/jobs/country/[code]/page.tsx → `/jobs/country/[code]`
- app/jobs/germany/page.tsx → `/jobs/germany`
- app/jobs/industry/[industry]/page.tsx → `/jobs/industry/[industry]`
- app/jobs/level/[level]/page.tsx → `/jobs/level/[level]`
- app/jobs/location/[country]/page.tsx → `/jobs/location/[country]`
- app/jobs/location/remote/route.ts → `/jobs/location/remote`
- app/jobs/page.tsx → `/jobs`
- app/jobs/skills/[skill]/page.tsx → `/jobs/skills/[skill]`
- app/jobs/skills/[skill]/remote/page.tsx → `/jobs/skills/[skill]/remote`
- app/jobs/state/[state]/page.tsx → `/jobs/state/[state]`
- app/jobs/uk/page.tsx → `/jobs/uk`
- app/jobs/usa/page.tsx → `/jobs/usa`
- app/layout.tsx → `/`
- app/not-found.tsx → `/`
- app/page.tsx → `/`
- app/post-a-job/page.tsx → `/post-a-job`
- app/pricing/page.tsx → `/pricing`
- app/remote/[role]/[location]/page.tsx → `/remote/[role]/[location]`
- app/remote/[role]/city/[city]/page.tsx → `/remote/[role]/city/[city]`
- app/remote/[role]/country/[country]/page.tsx → `/remote/[role]/country/[country]`
- app/remote/[role]/page.tsx → `/remote/[role]`
- app/remote/page.tsx → `/remote`
- app/robots.txt/route.ts → `/robots.txt`
- app/s/[slug]/page.tsx → `/s/[slug]`
- app/salary/[role]/[...loc]/page.tsx → `/salary/[role]/[...loc]`
- app/salary/[role]/page.tsx → `/salary/[role]`
- app/salary/page.tsx → `/salary`
- app/search/page.tsx → `/search`
- app/sitemap-browse.xml/route.ts → `/sitemap-browse.xml`
- app/sitemap-category.xml/route.ts → `/sitemap-category.xml`
- app/sitemap-company.xml/route.ts → `/sitemap-company.xml`
- app/sitemap-country.xml/route.ts → `/sitemap-country.xml`
- app/sitemap-jobs.xml/route.ts → `/sitemap-jobs.xml`
- app/sitemap-jobs/[page]/route.ts → `/sitemap-jobs/[page]`
- app/sitemap-level.xml/route.ts → `/sitemap-level.xml`
- app/sitemap-remote.xml/route.ts → `/sitemap-remote.xml`
- app/sitemap-salary.xml/route.ts → `/sitemap-salary.xml`
- app/sitemap-slices.xml/route.ts → `/sitemap-slices.xml`
- app/sitemap-slices/longtail/route.ts → `/sitemap-slices/longtail`
- app/sitemap-slices/priority/route.ts → `/sitemap-slices/priority`
- app/sitemap.xml/route.ts → `/sitemap.xml`
- app/test-shadcn/page.tsx → `/test-shadcn`

---

## Rule Index + Rules→Enforcement Matrix + conflict resolutions

### Rule Index (auto-extracted highlights)

| Rule ID | Priority | Category | Rule Text | Source |
|---|---|---|---|---|
| ARCH-001 | Important | Routing | Define the engineering contract for routing, rendering, caching, data access, and canonicalization so changes do not break: | docs/ARCHITECTURE_SPEC.md:4 (6figjobs — Architecture Spec (v1.0) > 0) Purpose) |
| ARCH-002 | Non-negotiable | Routing | This spec must not conflict with: | docs/ARCHITECTURE_SPEC.md:10 (6figjobs — Architecture Spec (v1.0) > 0) Purpose) |
| ARCH-003 | Important | Routing | - If role slug is non-canonical but maps to canonical → 301 to canonical URL. | docs/ARCHITECTURE_SPEC.md:35 (6figjobs — Architecture Spec (v1.0) > 3) Canonicalization & Param Validation (Hard Requirements) > 3.1 Canonical role slug must be validated at request-time) |
| ARCH-004 | Important | Routing | - If role slug is Tier-2 → allow page render but enforce `noindex` and exclude from sitemaps. | docs/ARCHITECTURE_SPEC.md:36 (6figjobs — Architecture Spec (v1.0) > 3) Canonicalization & Param Validation (Hard Requirements) > 3.1 Canonical role slug must be validated at request-time) |
| ARCH-005 | Important | Routing | - If role slug is invalid / garbage → 404 (notFound), do not redirect to homepage. | docs/ARCHITECTURE_SPEC.md:37 (6figjobs — Architecture Spec (v1.0) > 3) Canonicalization & Param Validation (Hard Requirements) > 3.1 Canonical role slug must be validated at request-time) |
| ARCH-006 | Non-negotiable | Routing | All internal links MUST be built using shared builders (e.g. `buildJobSlugHref`, role/location builders). | docs/ARCHITECTURE_SPEC.md:42 (6figjobs — Architecture Spec (v1.0) > 3) Canonicalization & Param Validation (Hard Requirements) > 3.2 Canonical URLs: single builder) |
| ARCH-007 | Non-negotiable | Routing | If homepage shows “stats” (jobs count, companies, etc.), it must use cached snapshot logic to avoid fluctuating values on every request. | docs/ARCHITECTURE_SPEC.md:51 (6figjobs — Architecture Spec (v1.0) > 4) Rendering & Caching Policy > 4.2 Stability requirement for homepage stats) |
| ARCH-008 | Non-negotiable | Routing | Listing pages must: | docs/ARCHITECTURE_SPEC.md:54 (6figjobs — Architecture Spec (v1.0) > 4) Rendering & Caching Policy > 4.3 Avoid per-request expensive joins for listing pages) |
| ARCH-009 | Important | Routing | - Always `select` minimal fields for list views. | docs/ARCHITECTURE_SPEC.md:61 (6figjobs — Architecture Spec (v1.0) > 5) Data Access Patterns > 5.1 Prisma usage rules) |
| ARCH-010 | Non-negotiable | Routing | - Use `redirect()` only for canonicalization, never as a fallback for unknown slugs. | docs/ARCHITECTURE_SPEC.md:71 (6figjobs — Architecture Spec (v1.0) > 6) Errors, Redirects, and 404 Rules) |
| ARCH-011 | Non-negotiable | Routing | - 500s must not be used for “missing data” cases; missing = 404 or empty state per SEO_SPEC quality gates. | docs/ARCHITECTURE_SPEC.md:72 (6figjobs — Architecture Spec (v1.0) > 6) Errors, Redirects, and 404 Rules) |
| ARCH-012 | Non-negotiable | Routing | Then it MUST follow RELEASE_QA_SPEC.md checks before merge. | docs/ARCHITECTURE_SPEC.md:99 (6figjobs — Architecture Spec (v1.0) > 9) Change Control Checklist for Architecture PRs) |
| ARCH-013 | Important | Routing | - Creating new indexable URL patterns without SEO_SPEC approval. | docs/ARCHITECTURE_SPEC.md:102 (6figjobs — Architecture Spec (v1.0) > 10) Forbidden Patterns (Must Not Ship)) |
| ARCH-014 | Important | Routing | - Slugifying role titles to create routes. | docs/ARCHITECTURE_SPEC.md:103 (6figjobs — Architecture Spec (v1.0) > 10) Forbidden Patterns (Must Not Ship)) |
| ARCH-015 | Important | Routing | - Putting Tier-2 or non-canonical roles into sitemaps. | docs/ARCHITECTURE_SPEC.md:104 (6figjobs — Architecture Spec (v1.0) > 10) Forbidden Patterns (Must Not Ship)) |
| ARCH-016 | Important | Routing | - Redirecting unknown slugs to homepage. | docs/ARCHITECTURE_SPEC.md:105 (6figjobs — Architecture Spec (v1.0) > 10) Forbidden Patterns (Must Not Ship)) |
| ARCH-017 | Important | Routing | - Adding filter/query-param pages to sitemaps. | docs/ARCHITECTURE_SPEC.md:106 (6figjobs — Architecture Spec (v1.0) > 10) Forbidden Patterns (Must Not Ship)) |
| ING-001 | Non-negotiable | Ingest | Hard requirement: | docs/DATA_INGEST_SPEC.md:22 (6figjobs — Data Ingest Spec (v1.0) > 2) Uniqueness & Dedupe (Critical) > 2.1 Unique key strategy) |
| ING-002 | Non-negotiable | Ingest | - Ingest must be idempotent. | docs/DATA_INGEST_SPEC.md:23 (6figjobs — Data Ingest Spec (v1.0) > 2) Uniqueness & Dedupe (Critical) > 2.1 Unique key strategy) |
| ING-003 | Non-negotiable | Ingest | - Race conditions must not crash the pipeline. | docs/DATA_INGEST_SPEC.md:24 (6figjobs — Data Ingest Spec (v1.0) > 2) Uniqueness & Dedupe (Critical) > 2.1 Unique key strategy) |
| ING-004 | Non-negotiable | Ingest | Role normalization must use canonical role slug system from SEO_SPEC. | docs/DATA_INGEST_SPEC.md:34 (6figjobs — Data Ingest Spec (v1.0) > 3) Canonical Role Normalization) |
| ING-005 | Important | Ingest | - do not generate indexable role pages from it | docs/DATA_INGEST_SPEC.md:39 (6figjobs — Data Ingest Spec (v1.0) > 3) Canonical Role Normalization) |
| ING-006 | Non-negotiable | Ingest | Salary display must be consistent with UI expectations. | docs/DATA_INGEST_SPEC.md:55 (6figjobs — Data Ingest Spec (v1.0) > 4) Salary Normalization > 4.3 Display formatting) |
| ING-007 | Non-negotiable | Ingest | - must not appear in indexable listings | docs/DATA_INGEST_SPEC.md:68 (6figjobs — Data Ingest Spec (v1.0) > 6) Expiry Rules) |
| ING-008 | Important | Ingest | - job page should be noindex or 404/redirect according to SEO_SPEC policy | docs/DATA_INGEST_SPEC.md:69 (6figjobs — Data Ingest Spec (v1.0) > 6) Expiry Rules) |
| ING-009 | Important | Ingest | - Creating role slugs by slugify(title) | docs/DATA_INGEST_SPEC.md:96 (6figjobs — Data Ingest Spec (v1.0) > 10) “Do Not Ship” Ingest Patterns) |
| ING-010 | Important | Ingest | - Writing raw location strings directly into indexable URLs | docs/DATA_INGEST_SPEC.md:97 (6figjobs — Data Ingest Spec (v1.0) > 10) “Do Not Ship” Ingest Patterns) |
| ING-011 | Non-negotiable | Ingest | - Failing the whole run on one job parse failure (must isolate errors) | docs/DATA_INGEST_SPEC.md:98 (6figjobs — Data Ingest Spec (v1.0) > 10) “Do Not Ship” Ingest Patterns) |
| ING-012 | Important | Ingest | - Marking everything expired on a single source outage | docs/DATA_INGEST_SPEC.md:99 (6figjobs — Data Ingest Spec (v1.0) > 10) “Do Not Ship” Ingest Patterns) |
| UX-001 | Non-negotiable | UX | - If filters are query params: keep them `noindex` and never include in sitemaps. | docs/DESIGN_UX_SPEC.md:25 (6figjobs — Design & UI/UX Spec (v1.0) > 2) Jobs Listing Page (e.g., /jobs, /remote/[role], /{country}/{role}) > 2.2 Filter behavior) |
| UX-002 | Non-negotiable | UX | - Pagination must be usable without infinite scroll. | docs/DESIGN_UX_SPEC.md:38 (6figjobs — Design & UI/UX Spec (v1.0) > 2) Jobs Listing Page (e.g., /jobs, /remote/[role], /{country}/{role}) > 2.4 Pagination rules) |
| UX-003 | Important | UX | - If no open roles: show graceful empty state + related companies/jobs (do not index thin pages unless SEO_SPEC allows) | docs/DESIGN_UX_SPEC.md:59 (6figjobs — Design & UI/UX Spec (v1.0) > 4) Company Page (/company/[slug]) > 4.1 Layout) |
| UX-004 | Non-negotiable | UX | Footer must remain clean and intentional: | docs/DESIGN_UX_SPEC.md:62 (6figjobs — Design & UI/UX Spec (v1.0) > 5) Footer Contract (Must Match SEO_SPEC)) |
| UX-005 | Non-negotiable | UX | - Legal links must be content-rich; remove DMCA if prohibited | docs/DESIGN_UX_SPEC.md:66 (6figjobs — Design & UI/UX Spec (v1.0) > 5) Footer Contract (Must Match SEO_SPEC)) |
| UX-006 | Non-negotiable | UX | - Logos/images must not cause layout shift. | docs/DESIGN_UX_SPEC.md:85 (6figjobs — Design & UI/UX Spec (v1.0) > 8) Performance UX) |
| UX-007 | Non-negotiable | UX | - Hiding critical filter UX behind multiple clicks on mobile | docs/DESIGN_UX_SPEC.md:88 (6figjobs — Design & UI/UX Spec (v1.0) > 9) “Do Not Ship” UX Patterns) |
| UX-008 | Important | UX | - Infinite scroll with no pagination fallback | docs/DESIGN_UX_SPEC.md:89 (6figjobs — Design & UI/UX Spec (v1.0) > 9) “Do Not Ship” UX Patterns) |
| UX-009 | Important | UX | - UI that creates uncontrolled URL variations | docs/DESIGN_UX_SPEC.md:90 (6figjobs — Design & UI/UX Spec (v1.0) > 9) “Do Not Ship” UX Patterns) |
| UX-010 | Important | UX | - Long, cluttered footer that repeats internal links excessively | docs/DESIGN_UX_SPEC.md:91 (6figjobs — Design & UI/UX Spec (v1.0) > 9) “Do Not Ship” UX Patterns) |
| OS-001 | Important | Release | - Canonical URLs only (SEO_SPEC owns definitions) | docs/PROJECT_OS.md:9 (6figjobs – Project Operating System > 2. Non-Negotiables) |
| OS-002 | Important | Release | - No index bloat (SEO_SPEC) | docs/PROJECT_OS.md:10 (6figjobs – Project Operating System > 2. Non-Negotiables) |
| OS-003 | Important | Release | - Stable slugs (ARCHITECTURE_SPEC) | docs/PROJECT_OS.md:11 (6figjobs – Project Operating System > 2. Non-Negotiables) |
| OS-004 | Important | Release | - Conversion-first UI (DESIGN_UX_SPEC) | docs/PROJECT_OS.md:12 (6figjobs – Project Operating System > 2. Non-Negotiables) |
| OS-005 | Important | Release | - Data correctness > volume (DATA_INGEST_SPEC) | docs/PROJECT_OS.md:13 (6figjobs – Project Operating System > 2. Non-Negotiables) |
| OS-006 | Non-negotiable | Release | → MUST follow RELEASE_QA_SPEC.md before merge or deploy. | docs/PROJECT_OS.md:42 (6figjobs – Project Operating System > 5. Change Control) |
| OS-007 | Important | Release | - Causing mass 404s, redirect loops, or noindex leaks | docs/PROJECT_OS.md:54 (6figjobs – Project Operating System > 6. Definition of a “Breaking Change”) |
| QA-001 | Non-negotiable | Release | Must be completed before merge: | docs/RELEASE_QA_SPEC.md:27 (6figjobs — Release & QA Spec (v1.0) > 2) Pre-Merge Checklist (Risk PR)) |
| QA-002 | Important | Release | - [ ] Spot-check: Tier-2 role page returns noindex | docs/RELEASE_QA_SPEC.md:41 (6figjobs — Release & QA Spec (v1.0) > 3) Pre-Deploy Checklist) |
| QA-003 | Important | Release | - [ ] Ensure noindex where expected | docs/RELEASE_QA_SPEC.md:60 (6figjobs — Release & QA Spec (v1.0) > 5) SEO Validation (After any SEO/Routing PR)) |
| RB-001 | Important | Release | - Do NOT publish any new pages | docs/ROLLBACK-PLAN.md:82 (SIX FIGURE JOBS - EMERGENCY ROLLBACK PLAN > Weeks 2-4: WAIT & MONITOR > Daily Monitoring) |
| RB-002 | Non-negotiable | Release | Never exceed these limits again: | docs/ROLLBACK-PLAN.md:148 (SIX FIGURE JOBS - EMERGENCY ROLLBACK PLAN > Prevention for Future > Publishing Limits) |
| RB-003 | Important | Release | - Always check GSC before publishing | docs/ROLLBACK-PLAN.md:152 (SIX FIGURE JOBS - EMERGENCY ROLLBACK PLAN > Prevention for Future > Publishing Limits) |
| RB-004 | Important | Release | - Rollback Script Location: scripts/emergency-noindex.ts | docs/ROLLBACK-PLAN.md:159 (SIX FIGURE JOBS - EMERGENCY ROLLBACK PLAN > Emergency Contacts) |
| SEOIMPL-001 | Important | SEO | - `metadataBase` configured; staging noindex/robots block | docs/SEO-IMPLEMENTATION-v1.5.md:23 (Six Figure Jobs — SEO Implementation v1.5 > Completed Work) |
| SEO-001 | Non-negotiable | SEO | ✅ Outputting complete files only (NEVER snippets or placeholders) | docs/SEO_SPEC.md:95 (- Core Web Vitals optimization rules > Current Completion (as of December 13, 2025)) |
| SEO-002 | Non-negotiable | SEO | **CRITICAL RULES:** | docs/SEO_SPEC.md:136 (- Core Web Vitals optimization rules > 2.1 Salary Threshold Strategy (LOCAL HIGH-PAYING JOBS)) |
| SEO-003 | Non-negotiable | SEO | - ✅ NEVER convert USD to GBP or vice versa | docs/SEO_SPEC.md:139 (- Core Web Vitals optimization rules > 2.1 Salary Threshold Strategy (LOCAL HIGH-PAYING JOBS)) |
| SEO-004 | Non-negotiable | SEO | **Format Pattern (NEVER CONVERT):** | docs/SEO_SPEC.md:146 (- Core Web Vitals optimization rules > 2.2 Salary Display Rules (Local Currency Only)) |
| SEO-005 | Important | SEO | non-indexed (noindex) unless explicitly promoted to Tier-1 | docs/SEO_SPEC.md:178 (- Core Web Vitals optimization rules > 3.1 PSEO Page Count Summary (UPDATED v2.7)) |
| SEO-006 | Important | SEO | \| Role Pages (Tier-2+) \| ~120 \| `/jobs/[role]` \| noindex \| | docs/SEO_SPEC.md:188 (- Core Web Vitals optimization rules > 3.1 PSEO Page Count Summary (UPDATED v2.7)) |
| SEO-007 | Important | SEO | \| Role+City (others) \| - \| - \| noindex \| | docs/SEO_SPEC.md:194 (- Core Web Vitals optimization rules > 3.1 PSEO Page Count Summary (UPDATED v2.7)) |
| SEO-008 | Non-negotiable | SEO | **v2.7 REDIRECT RULE:** All `/jobs/[role]/remote` URLs MUST 301 redirect to `/remote/[role]`. | docs/SEO_SPEC.md:199 (- Core Web Vitals optimization rules > 3.1 PSEO Page Count Summary (UPDATED v2.7)) |
| SEO-009 | Important | SEO | 9. SITEMAPS — COMPREHENSIVE COVERAGE | docs/SEO_SPEC.md:740 (- Core Web Vitals optimization rules > 8.2 Anchor Text Rules > **NEVER**) |
| SEO-010 | Non-negotiable | SEO | 12. NON-NEGOTIABLE RULES | docs/SEO_SPEC.md:893 (- Core Web Vitals optimization rules > 11.4 Git Commit Message Format) |
| SEO-011 | Non-negotiable | SEO | ❌ **NEVER:** | docs/SEO_SPEC.md:898 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-012 | Important | SEO | 1. Display jobs below LOCAL high-salary threshold | docs/SEO_SPEC.md:899 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-013 | Important | SEO | 2. Convert salaries between currencies | docs/SEO_SPEC.md:900 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-014 | Important | SEO | 3. Include entry-level, junior, or intern positions | docs/SEO_SPEC.md:901 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-015 | Important | SEO | 4. Output partial/incomplete code | docs/SEO_SPEC.md:902 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-016 | Important | SEO | 5. Skip structured data (JSON-LD) | docs/SEO_SPEC.md:903 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-017 | Important | SEO | 6. Use generic meta descriptions | docs/SEO_SPEC.md:904 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-018 | Important | SEO | 7. Create pages with <5 jobs | docs/SEO_SPEC.md:905 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-019 | Important | SEO | 8. Make URLs longer than 75 characters | docs/SEO_SPEC.md:906 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-020 | Important | SEO | 9. Skip FAQ schema on listing pages | docs/SEO_SPEC.md:907 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-021 | Important | SEO | 10. Deploy without testing on staging first | docs/SEO_SPEC.md:908 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-022 | Important | SEO | ✅ **ALWAYS:** | docs/SEO_SPEC.md:910 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-023 | Important | SEO | 1. Filter jobs by LOCAL salary threshold (PPP-adjusted) | docs/SEO_SPEC.md:911 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-024 | Important | SEO | 2. Display salary in ORIGINAL currency only | docs/SEO_SPEC.md:912 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-025 | Important | SEO | 3. Include brand + count + $100k in titles | docs/SEO_SPEC.md:913 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-026 | Important | SEO | 4. Add FAQ schema to all listing pages | docs/SEO_SPEC.md:914 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-027 | Important | SEO | 5. Use long-tail keywords in first paragraph | docs/SEO_SPEC.md:915 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-028 | Important | SEO | 6. Include BreadcrumbList on all pages | docs/SEO_SPEC.md:916 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-029 | Important | SEO | 7. Test on staging before production | docs/SEO_SPEC.md:917 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-030 | Important | SEO | 8. Monitor Google Search Console | docs/SEO_SPEC.md:918 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-031 | Important | SEO | 13. IMPLEMENTATION CHECKLIST | docs/SEO_SPEC.md:921 (- Core Web Vitals optimization rules > 12.1 Absolute Rules (NEVER VIOLATE)) |
| SEO-032 | Important | SEO | - [x] Staging noindex/robots block | docs/SEO_SPEC.md:936 (- Core Web Vitals optimization rules > 13.1 Completed ✅) |
| SEO-033 | Non-negotiable | SEO | min: range.min_cents / 100,  // CRITICAL: Convert from cents! | docs/SEO_SPEC.md:1876 (- Core Web Vitals optimization rules > 14.10 Accessibility Requirements > Reduced Motion) |
| SEO-034 | Non-negotiable | SEO | // CRITICAL BUG FIX: Ashby/Greenhouse cents conversion | docs/SEO_SPEC.md:1887 (- Core Web Vitals optimization rules > 14.10 Accessibility Requirements > Reduced Motion) |
| SEO-035 | Important | SEO | // Always check if value > 1,000,000 → divide by 100 | docs/SEO_SPEC.md:1890 (- Core Web Vitals optimization rules > 14.10 Accessibility Requirements > Reduced Motion) |
| SEO-036 | Important | SEO | // ALWAYS check if salary > 1,000,000 and divide by 100 | docs/SEO_SPEC.md:1983 (- Core Web Vitals optimization rules > 14.10 Accessibility Requirements > Reduced Motion) |
| SEO-037 | Non-negotiable | SEO | errors.push('Job title is required and must be > 5 chars'); | docs/SEO_SPEC.md:3283 (Index optimization - run weekly) |
| SEO-038 | Important | SEO | ✅ ALWAYS include "$100k" in anchor text for job links: | docs/SEO_SPEC.md:3532 (Index optimization - run weekly) |
| SEO-039 | Non-negotiable | SEO | ❌ NEVER use generic anchor text: | docs/SEO_SPEC.md:3537 (Index optimization - run weekly) |
| SEO-040 | Non-negotiable | SEO | -- Critical indexes for query performance | docs/SEO_SPEC.md:3895 (Index optimization - run weekly) |
| SEO-041 | Non-negotiable | SEO | // Lazy load filters and non-critical UI | docs/SEO_SPEC.md:4018 (Index optimization - run weekly) |
| SEO-042 | Non-negotiable | SEO | hasH1WithKeyword: boolean; // Must include "$100k" or "high paying" | docs/SEO_SPEC.md:4373 (Node environment) |
| SEO-043 | Important | SEO | node scripts/emergency-noindex.ts --threshold=10 | docs/SEO_SPEC.md:4480 (Days 2-7: Damage Control) |
| SEO-044 | Non-negotiable | SEO | // /jobs/150k-plus MUST 301 redirect to /jobs/100k-plus | docs/SEO_SPEC.md:4719 (Share: Pages published, coverage %, issues found) |
| SEO-045 | Important | SEO | 4. If !isTier1Role(role) → Add noindex meta tag | docs/SEO_SPEC.md:5968 (Days 2-7: Add noindex to thin pages) |
| ARCHIVE-001 | Important | SEO | - `metadataBase` configured; staging noindex/robots block | docs/archive/SEO_IMPLEMENTATION_v1.5_2025-12-11_DEPRECATED.md.md:23 (Six Figure Jobs — SEO Implementation v1.5 > Completed Work) |

### Conflict resolutions (by authority)

- PROJECT_OS says **Railway** + **no staging** (`docs/PROJECT_OS.md`), but multiple docs require staging and VPS/systemd; resolve by moving VPS docs to archive or rewriting to Railway-only.
- SEO_SPEC contains both “Test on staging before production” and “No staging environment is currently enabled”; resolve by defining a preview deploy path on Railway or adjust QA rules to production-safe verification.

### Rules → Enforcement Matrix (manual mapping for key non-negotiables)

| Rule | Where enforced today | Gap | Suggested assertion/test |
|---|---|---|---|
| Canonical URLs only | Many pages set `alternates.canonical`; middleware apex→www | Listing JSON-LD pages emit legacy job URLs | QA check: JSON-LD URLs must use `/job/<title>-j-<short>` |
| No index bloat | Some pages set robots noindex; tiering on remote | Slice sitemaps include thin pages; thresholds too low | QA check: sitemap excludes pages with <10 jobs |
| Stable slugs | `lib/jobs/jobSlug.ts` (FNV-1a suffix) | Listing JSON-LD still uses raw ids | Unit test: slug builder stable + used in structured data |
| /jobs/[role]/remote redirects to /remote/[role] | `app/jobs/[role]/remote/page.tsx` | Uses 308 not 301 (Next behavior) | Curl check for 308 + Location |

---

## Duplicate/Conflict Report (code + docs)

### Code duplicates/overlaps

- Prisma client: `lib/prisma.ts` (TS) vs `lib/db/client.js` (JS). Source of truth should be `lib/prisma.ts`.
- Salary threshold: `lib/currency/thresholds.ts` vs `lib/jobs/salaryThresholds.ts` vs `lib/ingest/greenhouseSalaryParser.ts`. Pick one and deprecate the others.
- Site URL derivation: `lib/seo/site.ts` vs ad-hoc RAILWAY_PUBLIC_DOMAIN usage in multiple sitemap routes + `app/layout.tsx` local helper.
- Job list JSON-LD: central helper in `lib/seo/structuredData.ts` vs hand-rolled ItemList blocks in many `app/jobs/**` pages (some emit legacy job URLs).

### Docs duplicates/overlaps

- `docs/SEO-IMPLEMENTATION-v1.5.md` and `docs/archive/SEO_IMPLEMENTATION_v1.5_2025-12-11_DEPRECATED.md.md` appear duplicated.
- Rollback content appears in both `docs/ROLLBACK-PLAN.md` and inlined in `docs/SEO_SPEC.md`.
- `lib/claude-rules-v2.6.md` duplicates sections of `docs/SEO_SPEC.md` (not authoritative; should be moved to docs/archive or removed).

---

## File-by-file audit log (EVERY FILE)

Path:
.chatgpt-commands
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
.chatgpt-rules
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
.env.example
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
.eslintrc.json
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
.github/workflows/daily-scrape.yml
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
.github/workflows/deploy.yml.disabled
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
.github/workflows/scraper-staging.yml
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
.gitignore
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
.vercelignore
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
FETCH_HEAD
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: 🗑️ Dead/Duplicate
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
TEST_DEPLOY.md
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/api/cron/scrape/route.ts
Type: route
Purpose: Next.js route handler for `/api/cron/scrape`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/api/scrape/route.ts
Type: route
Purpose: Next.js route handler for `/api/scrape`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/companies/page.tsx
Type: route
Purpose: Next.js page for `/companies`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/company/[slug]/head.tsx
Type: route
Purpose: Next.js head for `/company/[slug]`
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/company/[slug]/page.tsx
Type: route
Purpose: Next.js page for `/company/[slug]`
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/company/page.tsx
Type: route
Purpose: Next.js page for `/company`
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/components/JobCard.tsx
Type: route
Purpose: App-level UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/components/JobList.tsx
Type: route
Purpose: App-level UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/components/RoleTypeahead.tsx
Type: route
Purpose: App-level UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/globals.css
Type: route
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/job/[slug]/head.tsx
Type: route
Purpose: Next.js head for `/job/[slug]`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*
Status: ✅ Good
Findings:

GOOD:
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/job/[slug]/page.tsx
Type: route
Purpose: Next.js page for `/job/[slug]`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*
Status: ✅ Good
Findings:

GOOD:
- Uses `permanentRedirect()`
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/100k-plus-jobs/page.tsx
Type: route
Purpose: Next.js page for `/jobs/100k-plus-jobs`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/100k-plus/page.tsx
Type: route
Purpose: Next.js page for `/jobs/100k-plus`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/150k-plus/page.tsx
Type: route
Purpose: Next.js page for `/jobs/150k-plus`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Uses `permanentRedirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/200k-plus-jobs/page.tsx
Type: route
Purpose: Next.js page for `/jobs/200k-plus-jobs`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/200k-plus/page.tsx
Type: route
Purpose: Next.js page for `/jobs/200k-plus`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/300k-plus-jobs/page.tsx
Type: route
Purpose: Next.js page for `/jobs/300k-plus-jobs`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/300k-plus/page.tsx
Type: route
Purpose: Next.js page for `/jobs/300k-plus`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/400k-plus-jobs/page.tsx
Type: route
Purpose: Next.js page for `/jobs/400k-plus-jobs`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/400k-plus/page.tsx
Type: route
Purpose: Next.js page for `/jobs/400k-plus`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/[...slug]/head.tsx
Type: route
Purpose: Next.js head for `/jobs/[...slug]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/[role]/[filter]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/[role]/[filter]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/[role]/city/[city]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/[role]/city/[city]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/[role]/country/[country]/route.ts
Type: route
Purpose: Next.js route handler for `/jobs/[role]/country/[country]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/[role]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/[role]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ❌ Wrong
Findings:

GOOD:
- Uses `queryJobs()` abstraction for list retrieval; has FAQ + breadcrumbs + ItemList JSON-LD.

WRONG:
- No canonical role slug validation or Tier-1/Tier-2 indexation gating (ARCHITECTURE_SPEC 3.1 violation).
- ItemList JSON-LD uses non-canonical job URLs (`/job/${job.id}`) instead of v2.8 slug builder.
- Canonical + OG URLs are hard-coded to `https://www.6figjobs.com` (inconsistent with `getSiteUrl()`/middleware).

RISK:
- Index bloat at scale; mixed canonical signals; Google Jobs structured data pointing at legacy URLs.
Actions:

Must fix:
- Enforce canonical role slugs + tiering; switch JSON-LD job URLs to `buildJobSlugHref()`; unify canonical base URL.

Should fix:
- Consider reusing `lib/seo/structuredData.buildJobListJsonLd` to reduce drift.

Nice to have:
- (none)
Blast radius: Role hub pages; internal linking; structured data; indexation control

Path:
app/jobs/[role]/remote/page.tsx
Type: route
Purpose: Next.js page for `/jobs/[role]/remote`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Uses `permanentRedirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/[role]/skills/[skill]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/[role]/skills/[skill]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/_components/SlicePage.tsx
Type: route
Purpose: Miscellaneous
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/_components/page.tsx
Type: route
Purpose: Next.js page for `/jobs/_components`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/canada/page.tsx
Type: route
Purpose: Next.js page for `/jobs/canada`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/category/[category]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/category/[category]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/city/[city]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/city/[city]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/country/[code]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/country/[code]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/germany/page.tsx
Type: route
Purpose: Next.js page for `/jobs/germany`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/industry/[industry]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/industry/[industry]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/level/[level]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/level/[level]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/location/[country]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/location/[country]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/location/remote/route.ts
Type: route
Purpose: Next.js route handler for `/jobs/location/remote`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ❌ Wrong
Findings:

GOOD:
- Provides a redirect for legacy `/jobs/location/remote`.

WRONG:
- Uses `redirect()` (307) and points to a single role (`/remote/software-engineer`) rather than a canonical remote hub.
- Referenced by `app/sitemap-browse.xml/route.ts` which should not sitemap redirects.

RISK:
- SEO confusion + crawl waste; potential doorway behaviour.
Actions:

Must fix:
- Remove from sitemaps; if kept, use `permanentRedirect()` and redirect to `/remote` (or a true canonical hub).

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: Remote discovery; sitemap-browse; redirects

Path:
app/jobs/page.tsx
Type: route
Purpose: Next.js page for `/jobs`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/skills/[skill]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/skills/[skill]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/skills/[skill]/remote/page.tsx
Type: route
Purpose: Next.js page for `/jobs/skills/[skill]/remote`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/state/[state]/page.tsx
Type: route
Purpose: Next.js page for `/jobs/state/[state]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/uk/page.tsx
Type: route
Purpose: Next.js page for `/jobs/uk`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/jobs/usa/page.tsx
Type: route
Purpose: Next.js page for `/jobs/usa`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/layout.tsx
Type: route
Purpose: Next.js layout for `/`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/not-found.tsx
Type: route
Purpose: Next.js route file for `/`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/page.tsx
Type: route
Purpose: Next.js page for `/`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/pageFAQ.tsx
Type: route
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/post-a-job/page.tsx
Type: route
Purpose: Next.js page for `/post-a-job`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/pricing/page.tsx
Type: route
Purpose: Next.js page for `/pricing`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/remote/[role]/[location]/page.tsx
Type: route
Purpose: Next.js page for `/remote/[role]/[location]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`
- Sets `alternates.canonical`
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/remote/[role]/city/[city]/page.tsx
Type: route
Purpose: Next.js page for `/remote/[role]/city/[city]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`
- Sets `alternates.canonical`
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/remote/[role]/country/[country]/page.tsx
Type: route
Purpose: Next.js page for `/remote/[role]/country/[country]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`
- Sets `alternates.canonical`
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/remote/[role]/page.tsx
Type: route
Purpose: Next.js page for `/remote/[role]`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Uses `permanentRedirect()`
- Uses `redirect()`
- Sets `robots.index=false`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/remote/page.tsx
Type: route
Purpose: Next.js page for `/remote`
SEO relevance: direct
Docs rules impacted: SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/robots.txt/route.ts
Type: route
Purpose: Next.js route handler for `/robots.txt`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/s/[slug]/page.tsx
Type: route
Purpose: Next.js page for `/s/[slug]`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/salary/[role]/[...loc]/page.tsx
Type: route
Purpose: Next.js page for `/salary/[role]/[...loc]`
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/salary/[role]/page.tsx
Type: route
Purpose: Next.js page for `/salary/[role]`
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/salary/page.tsx
Type: route
Purpose: Next.js page for `/salary`
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/search/page.tsx
Type: route
Purpose: Next.js page for `/search`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ⚠️ Risky
Findings:

GOOD:
- Uses `redirect()`
- Sets `robots.index=false`
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/sitemap-browse.xml/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-browse.xml`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ❌ Wrong
Findings:

GOOD:
- Central browse sitemap exists and enumerates key pSEO hubs.

WRONG:
- Includes non-canonical redirecting URL `/jobs/location/remote` in sitemap.
- Duplicates industry URLs (two INDUSTRY_TARGETS loops).
- Derives SITE_URL ad-hoc instead of shared `getSiteUrl()` (canonical drift risk).

RISK:
- Index bloat + crawl waste + mixed canonical domains.
Actions:

Must fix:
- Only emit canonical, index-worthy URLs; remove redirecting URLs; dedupe; use `getSiteUrl()`.

Should fix:
- Escape XML + add lastmod where useful.

Nice to have:
- (none)
Blast radius: Sitemap integrity; crawl budget; canonical selection

Path:
app/sitemap-category.xml/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-category.xml`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/sitemap-company.xml/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-company.xml`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/sitemap-country.xml/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-country.xml`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/sitemap-jobs.xml/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-jobs.xml`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/sitemap-jobs/[page]/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-jobs/[page]`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/sitemap-level.xml/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-level.xml`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/sitemap-remote.xml/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-remote.xml`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/sitemap-salary.xml/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-salary.xml`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/sitemap-slices.xml/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-slices.xml`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/sitemap-slices/longtail/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-slices/longtail`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ❌ Wrong
Findings:

GOOD:
- Longtail slice sitemap attempts to avoid very thin pages.

WRONG:
- Includes slices with `jobCount >= 5` (still thin; conflicts with docs that remove <10 from sitemap).

RISK:
- Index bloat; crawl waste; possible manual actions.
Actions:

Must fix:
- Raise thresholds (e.g., `jobCount >= 10`) and ensure slice pages noindex when under threshold.

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: Slice indexation; sitemap quality

Path:
app/sitemap-slices/priority/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap-slices/priority`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ❌ Wrong
Findings:

GOOD:
- Slice sitemap exists for discovery of slice pages.

WRONG:
- Includes slices with `jobCount > 0` if recently updated (can include extremely thin pages).

RISK:
- Violates zero index bloat rules; increases risk of Google quality issues.
Actions:

Must fix:
- Enforce minimum jobCount for sitemap inclusion (align with SEO_SPEC/ROLLBACK thresholds).

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: Slice indexation; sitemap quality

Path:
app/sitemap.xml/route.ts
Type: route
Purpose: Next.js route handler for `/sitemap.xml`
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*, ARCH-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
app/test-shadcn/page.tsx
Type: route
Purpose: Next.js page for `/test-shadcn`
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `robots.index=false`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
audit-implementation.sh
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components.json
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/jobs/JobCardSkeleton.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/jobs/JobCardV2.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/layout/Footer.tsx
Type: component
Purpose: Shared UI component
SEO relevance: direct
Docs rules impacted: UX-*, SEO-*
Status: ❌ Wrong
Findings:

GOOD:
- Strong internal linking hub for Tier-1 role/skill/industry/salary pages.

WRONG:
- Links to missing routes: `/about`, `/privacy`, `/terms`, `/cookies` (404 trust signals).

RISK:
- Hurts E-E-A-T, conversions, and crawl quality; creates broken internal links sitewide.
Actions:

Must fix:
- Add the missing legal/about routes (preferred) or remove/replace links.

Should fix:
- Confirm anchors comply with SEO_SPEC (controlled link volume and canonical hubs).

Nice to have:
- (none)
Blast radius: Sitewide footer; all crawls; trust

Path:
components/layout/MobileNav.tsx
Type: component
Purpose: Shared UI component
SEO relevance: direct
Docs rules impacted: UX-*, SEO-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/search/SearchInput.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/theme-provider.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/avatar.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/badge.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/button.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/card.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/checkbox.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/dialog.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/dropdown-menu.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/input.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/select.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/separator.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/sheet.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/skeleton.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/slider.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/toast.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
components/ui/toaster.tsx
Type: component
Purpose: Shared UI component
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
docs/ARCHITECTURE_SPEC.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ✅ Good
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
docs/DATA_INGEST_SPEC.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
docs/DESIGN_UX_SPEC.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
docs/PROJECT_OS.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
docs/RELEASE_QA_SPEC.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
docs/ROLLBACK-PLAN.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ⚠️ Risky
Findings:

GOOD:
- Defines triggers and response steps for SEO incidents.

WRONG:
- References scripts that do not exist (`scripts/find-thin-pages.ts`, `scripts/emergency-noindex.ts`, `scripts/rebuild-sitemap.ts`).

RISK:
- Rollback plan not executable as written; delays response to penalties.
Actions:

Must fix:
- Create the referenced scripts or update the plan to match real tooling.

Should fix:
- Align environment assumptions (Railway vs VPS/pm2).

Nice to have:
- (none)
Blast radius: Incident response; SEO recovery time

Path:
docs/SEO-IMPLEMENTATION-v1.5.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
docs/SEO_SPEC.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ✅ Good
Findings:

GOOD:
- Uses `redirect()`
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
docs/archive/SEO_IMPLEMENTATION_v1.5_2025-12-11_DEPRECATED.md.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
docs/deployment/RAILWAY_DEPLOYMENT.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ❌ Wrong
Findings:

GOOD:
- States Railway is authoritative infrastructure.

WRONG:
- Markdown code fence is unclosed/incomplete (doc ends mid-block).

RISK:
- Conflicts with `docs/deployment/README.md` + `docs/deployment/SERVER_SETUP.md` (VPS-based).
Actions:

Must fix:
- Complete the Railway deployment doc and move/mark VPS docs as archived (or vice versa, but pick one).

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: Release process; on-call operations

Path:
docs/deployment/README.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
docs/deployment/SERVER_SETUP.md
Type: docs
Purpose: Project spec / documentation
SEO relevance: direct
Docs rules impacted: (Rule source)
Status: ❌ Wrong
Findings:

GOOD:
- Contains detailed server setup steps (useful if VPS is real).

WRONG:
- Contains plaintext credentials (DB password) committed to repo.
- Conflicts with PROJECT_OS/Railway docs about infra and staging.

RISK:
- Security + trust risk; operational confusion.
Actions:

Must fix:
- Remove secrets from repo history (rotate creds) and reconcile infra docs.

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: Security; production operations

Path:
hooks/use-toast.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
hooks/useJobScraper.js
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/ai/jobAnnotator.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/ai/openaiClient.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/claude-rules-v2.6.md
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Uses `redirect()`
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/companies/logo.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/companies/upsertFromBoard.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/constants/category-links.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/constants/homepage.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/currency/thresholds.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/db/client.js
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/ingest/dedupeHelpers.ts
Type: lib
Purpose: Job ingest pipeline
SEO relevance: none
Docs rules impacted: ING-*, OS-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/ingest/greenhouseSalaryParser.ts
Type: lib
Purpose: Job ingest pipeline
SEO relevance: none
Docs rules impacted: ING-*, OS-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/ingest/index.ts
Type: lib
Purpose: Job ingest pipeline
SEO relevance: none
Docs rules impacted: ING-*, OS-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/ingest/jobAgeFilter.ts
Type: lib
Purpose: Job ingest pipeline
SEO relevance: none
Docs rules impacted: ING-*, OS-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/ingest/sourcePriority.ts
Type: lib
Purpose: Job ingest pipeline
SEO relevance: none
Docs rules impacted: ING-*, OS-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/ingest/types.ts
Type: lib
Purpose: Job ingest pipeline
SEO relevance: none
Docs rules impacted: ING-*, OS-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/jobs/expiry.ts
Type: lib
Purpose: Job querying/logic
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/jobs/ingestBoardJob.ts
Type: lib
Purpose: Job querying/logic
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/jobs/ingestFromAts.ts
Type: lib
Purpose: Job querying/logic
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/jobs/jobSlug.ts
Type: lib
Purpose: Canonical job slug builder/parser
SEO relevance: critical
Docs rules impacted: OS-*, SEO-*
Status: ✅ Good
Findings:

GOOD:
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/jobs/nlToFilters.ts
Type: lib
Purpose: Job querying/logic
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/jobs/queryJobs.ts
Type: lib
Purpose: Job querying/logic
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/jobs/salary.ts
Type: lib
Purpose: Job querying/logic
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/jobs/salaryBands.ts
Type: lib
Purpose: Job querying/logic
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/jobs/salaryThresholds.ts
Type: lib
Purpose: Job querying/logic
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/jobs/searchSlug.ts
Type: lib
Purpose: Job querying/logic
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/navigation/breadcrumbs.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/navigation/internalLinks.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/normalizers/ats.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/normalizers/company.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/normalizers/location.test.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/normalizers/location.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/normalizers/role.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/normalizers/salary.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/prisma.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/roles/canonicalSlugs.ts
Type: lib
Purpose: Role slug canonicalization + tiering
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/roles/salaryRoles.ts
Type: lib
Purpose: Role slug canonicalization + tiering
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/roles/searchRoles.ts
Type: lib
Purpose: Role slug canonicalization + tiering
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/roles/slugMatcher.ts
Type: lib
Purpose: Role slug canonicalization + tiering
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/roles/synonyms.ts
Type: lib
Purpose: Role slug canonicalization + tiering
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/salary/engine.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/_boardHelpers.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ashby-companies.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ashby.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ats/[provider]/route.js
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ats/ashby.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ats/greenhouse.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ats/index.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ats/lever.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ats/route.js
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ats/types.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ats/workday.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/base.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/builtin.js
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/fixCorruptSalaries.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/fourdayweek.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/generic.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/greenhouse.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/helpers/salaryFlags.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/justjoin.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/lever-companies.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/nodesk.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/realworkfromanywhere.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/remote100k.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/remoteai.js
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/remoteok.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/remoteotter.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/remoterocketship.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/remotive.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/trawle.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/types.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/weworkremotely.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/workday-companies.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/workday.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/scrapers/ycombinator.ts
Type: lib
Purpose: Scrapers for ATS/boards
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/canonical.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/company.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/companyJsonLd.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/companyMeta.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/countrySlug.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/jobJsonLd.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/jobMeta.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/meta.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Sets `alternates.canonical`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/pseoTargets.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/regions.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/site.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/seo/structuredData.ts
Type: lib
Purpose: SEO utilities (canonicals, metadata, structured data)
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Uses job slug builder

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/slices/builder.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/slices/engine.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/slices/loadSlice.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/slices/rebuild.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/slices/rebuild/route.js
Type: lib
Purpose: Miscellaneous
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/slices/types.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: direct
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/types/ats.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/utils.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/utils/number.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/utils/salaryLabels.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
lib/utils/time.ts
Type: lib
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
logs/qa-2025-11-28.json
Type: other
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
logs/scrape-2025-11-28.json
Type: other
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
middleware.ts
Type: config
Purpose: Miscellaneous
SEO relevance: critical
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- Uses `redirect()`

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
next-env.d.ts
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
next.config.js
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
package-lock.json
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
package.json
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: QA-*
Status: ❌ Wrong
Findings:

GOOD:
- Defines build/start/dev scripts and uses Prisma generate in build.

WRONG:
- `lint` runs `next lint` but Next.js v16 CLI has no `lint` command (breaks QA).
- `generate:sitemap` references missing `scripts/generate-sitemap.ts`.

RISK:
- Broken QA scripts reduce release discipline (PROJECT_OS + RELEASE_QA_SPEC).
Actions:

Must fix:
- Replace `lint` with `eslint` (or dedicated runner) and fix/remove `generate:sitemap` script reference.

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: CI/dev workflow; release QA

Path:
postcss.config.js
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/migrations/20251122183203_init_jobs/migration.sql
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/migrations/20251122213545_switch_salary_to_bigint/migration.sql
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/migrations/20251124012311_add_company_description/migration.sql
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/migrations/20251124153623_add_remote_mode_and_company_meta/migration.sql
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/migrations/20251124163812_add_description_and_company_meta_fields/migration.sql
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/migrations/20251126122407_add_company_source_scrape_run/migration.sql
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/migrations/20251126184844_add_dedupe_fields/migration.sql
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/migrations/20251127183928_phase4_company_trust_fields/migration.sql
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/migrations/20251128144625_add_seo_fields/migration.sql
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/migrations/migration_lock.toml
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ❌ Wrong
Findings:

GOOD:
- File exists and is tracked as expected by Prisma migrate.

WRONG:
- `provider = "sqlite"` conflicts with `prisma/schema.prisma` datasource `postgresql` (schema drift risk).

RISK:
- Signals migrations are not the source of truth for production schema; `db push` drift likely.
Actions:

Must fix:
- Decide migration strategy: baseline Postgres and switch to `prisma migrate deploy` going forward.

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: All DB deploys; schema drift; runtime errors on rollout

Path:
prisma/schema.prisma
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
prisma/seed-remote-companies.ts
Type: prisma
Purpose: Prisma schema/migrations/seed
SEO relevance: indirect
Docs rules impacted: DATA-*
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
public/README-IMAGES.md
Type: other
Purpose: Public asset
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
public/llms.txt
Type: other
Purpose: Public asset
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
public/logo.png
Type: other
Purpose: Public asset
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
public/logo.svg
Type: other
Purpose: Public asset
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
public/og-image.png
Type: other
Purpose: Public asset
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
remote100k-debug.png
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
run-daily-scrape.sh
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/addMissingCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/addMoreCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/addRemoteCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/aiAnnotateJobs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/analyzeRoles.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/auditCompanyMetrics.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/auditCurrencyLocationMismatches.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/auditSalary.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/auditSalary2.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfill-company-logos.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfill-high-salary-local.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfill-shortId.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfillAtsLogos.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfillCompanyLogos.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfillCompanyProfiles.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfillDedupeKeys.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfillJobLogos.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfillLinkedinHeuristics.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfillRemoteCountry.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/backfillSeoFields.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/bootstrapAllRoleSlices.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/bootstrapCountrySalarySlices.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/bootstrapHighSalarySlices.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/bootstrapRoleSalaryBands.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/bootstrapRoleSlices.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkAnthropicJob.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkAnthropicJobs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkAnyDescriptions.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkCompany.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkCompanyData.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkGreenhouseSalary.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkJobSources.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkMinSalary.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkRawJob.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkSalaries.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/checkSoftwareEngineerUS.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/cleanup-bad-companies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/cleanup-non-canonical-role-slugs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/cleanup404.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/cleanupRoleSlugs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/clearCrazySalaries.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/createTestSlice.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/dailyScrape.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/dailyScrapeV2.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/debugDescriptions.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/debugSalaryRegex.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/debugSalaryRegex2.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/debugSalaryRegex3.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/debugSlices.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/debugUSJob.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/deepDiscovery.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/deleteAshbyJobs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/deployment/deploy-production.sh
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/deployment/start-staging.sh
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/deployment/stop-staging.sh
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/disableBadAtsCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/disableBadGreenhouseSlugs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/discoverATS.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/discoverATSBulk.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/discoverATSSlugs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/discoverCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/enrichAtsMetadata.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/extractGreenhouseSalaries.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fetchCompanyDescriptions.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fetchRemoteCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/findGreenhouseCompany.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/findSalaryInDesc.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/findSalaryInDesc2.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fix-instacart-merge.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fix-instacart.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixAllSalaries.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixAllSalariesV2.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixAndAddCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixBadCompanyNames.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixBadMin.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixCorruptSalaries.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixExact1M.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixGreenhouseSlugs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixLeverSlugs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixLocationNormalizer.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixMissingCompanySlugs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixSalaryOutliers.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/fixUSSalaries.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/generateJobSlices.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/ingestBoards.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/mergeDuplicates.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/monitoring-dashboard.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/normalizeLocations.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/publish-pseo-batch.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/qa.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/qaSalaryCoverage.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/qaScrapers.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/rebuildRoleSlugs.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/repairCurrencyAndSalary.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/repairLocations.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/repairMinMaxSalary.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/reportAtsCoverage.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/reprocessAnthropicSalaries.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/researchJobBoards.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/resetDatabase.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/salarySanityCleanup.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/salarySanityCleanupV2.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/salarySanityCleanupV3.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/scrapeCareerPages.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/scrapeGitHub.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/scrapeMoreCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/scrapeNodeskCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/seed.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/seedJobSlices.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/seedTopCompanies.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/setTestJobSalary.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/smokeScrapers.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/testAtsScraper.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/testBoardScrapers.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/testDescriptionScrape.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/testLocationNormalizer.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/testLocationSamples.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/testRemote100k.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/testRemote100kIntegration.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/testWorkingGreenhouse.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/updateSalaryFlags.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/verifyAtsPipeline.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
scripts/verifyFix.ts
Type: script
Purpose: Operational script
SEO relevance: indirect
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
tailwind.config.js
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
trigger.txt
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
tsconfig.json
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ✅ Good
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)

Path:
tsconfig.tsbuildinfo
Type: config
Purpose: Miscellaneous
SEO relevance: none
Docs rules impacted: (none mapped)
Status: ⚠️ Risky
Findings:

GOOD:
- (none)

WRONG:
- (none)

RISK:
- (none)
Actions:

Must fix:
- (none)

Should fix:
- (none)

Nice to have:
- (none)
Blast radius: (unscoped)


---

## Metadata Matrix

| Page Type | Example | Title/Description pattern | Canonical | Robots | JSON-LD |
|---|---|---|---|---|---|
| Home | `/` | hard-coded marketing copy | `https://www.6figjobs.com` | index | WebSite + Organization (`app/page.tsx`) |
| Job detail | `/job/<title>-j-<short>` | `${title} at ${company} — ${salary}` | `buildJobSlugHref()` | noindex if expired | JobPosting (`lib/seo/jobJsonLd.ts`) |
| Remote role | `/remote/[role]` | `${count} Remote ${role} $100k+ Jobs` | `/remote/[role]` | Tier-1 index else noindex | ItemList + FAQ (`app/remote/[role]/page.tsx`) |
| City/state/skill | `/jobs/city/[city]` | `$100k+ jobs in …` | route canonical | total>=3 index | ItemList + FAQ (but job URLs currently legacy in some pages) |
| Search | `/search?...` | dynamic | canonicalized query | noindex | none |

---

## Sitemap Integrity Report

- `app/sitemap.xml/route.ts`: sitemap index; lastmod is build time for all entries.
- `app/sitemap-jobs.xml/route.ts` + `app/sitemap-jobs/[page]/route.ts`: canonical job URLs via `buildJobSlugHref`; per-job lastmod uses `updatedAt`.
- `app/sitemap-company.xml/route.ts`: includes companies where `jobCount > 0`; uses ad-hoc SITE_URL.
- `app/sitemap-remote.xml/route.ts`: Tier-1 canonical roleSlugs only.
- `app/sitemap-browse.xml/route.ts`: violations (redirect URL included; duplicates; ad-hoc SITE_URL).
- `app/sitemap-slices.xml/route.ts` + priority/longtail: violations (thin pages included).

---

## Google Jobs Readiness Report

**Fail (must fix)**
- Listing pages emit JobPosting entries pointing at non-canonical URLs (legacy `/job/${job.id}`), conflicting with canonical slug system.

**Pass (job detail page)**
- `lib/seo/jobJsonLd.ts` provides JobPosting with datePosted, non-empty description, remote handling, and stable canonical url.

---

## Internal linking + orphan report

- Main link hubs: header nav (`app/layout.tsx`), footer (`components/layout/Footer.tsx`), internalLinks helper (`lib/navigation/internalLinks.ts`), slice pages (`app/jobs/_components/SlicePage.tsx`).
- Broken internal links (footer): `/about`, `/privacy`, `/terms`, `/cookies`.
- Likely orphan/UX-only routes: `/test-shadcn` (`app/test-shadcn/page.tsx`), `/jobs/_components` (internal dev). Ensure noindex or remove from nav/sitemaps.

---

## Recent changes verification (308 redirects + shortId + backfill + ingest)

- Job detail redirects: `app/job/[slug]/page.tsx` uses `permanentRedirect()` to canonical `/job/<title>-j-<short>`.
- Backwards compatibility: `lib/jobs/jobSlug.ts` parses legacy `-job-<raw>`, `-jid-<base64url>`, raw ATS ids, and v2.8 short slugs.
- Rollout safety: job page checks DB column existence before querying `shortId`.
- Schema: `prisma/schema.prisma` adds `shortId String? @unique`.
- Backfill: `scripts/backfill-shortId.ts` populates `shortId` using same hash algorithm and stops on collision.
- Ingest: `lib/ingest/index.ts` writes/repairs `shortId` on create/update.

---

## Scale stress test summary

- At 100k+ jobs: sitemap shards (20k/page) OK; but browse/slice sitemaps risk bloat unless thresholds enforced.
- At 500k–1M jobs: DB-heavy ISR pages (homepage counts, role pages) require caching strategy and indexes; slice queries need pagination + limits.
- Critical: keep sitemaps strictly Tier-1 + quality-gated to avoid crawl budget collapse.

---

## Safe publishing plan (no Google penalty)

1. Index first (safe): /remote Tier-1 roles, /jobs/100k-plus, top country hubs with strong counts.
2. Index conditional: state/city/skill/industry only when >=10 jobs and unique content gates pass.
3. Noindex (UX-only): /search, filter/param pages, thin slices.
4. Do not generate: uncontrolled city×role×skill combos unless Tier-1 + jobCount gate.
5. Monitor in GSC: coverage, canonicals, crawl stats, Jobs enhancements, soft 404.

---

## Final fix checklist (BLOCKERS / HIGH / MED-LOW / DO-NOT-CHANGE)

### BLOCKERS
- Fix listing JSON-LD job URLs to canonical v2.8 slugs (multiple `app/jobs/**` pages).
- Remove redirecting/non-canonical URLs from sitemaps (`app/sitemap-browse.xml/route.ts`).
- Enforce slice sitemap thresholds (`app/sitemap-slices/**`).
- Add missing legal/about pages (or remove footer links) (`components/layout/Footer.tsx`).
- Resolve Prisma migration strategy mismatch (`prisma/migrations/*` vs Postgres).

### HIGH
- Standardize permanent redirects for canonicalization routes.
- Raise allowIndex thresholds to match docs.
- Standardize SITE_URL derivation via `lib/seo/site.getSiteUrl()`.
- Fix broken QA scripts (lint, generate:sitemap).

### MED-LOW
- Remove tracked build artifacts (`FETCH_HEAD`, `tsconfig.tsbuildinfo`).
- Deduplicate salary threshold helpers.
- Clean up outdated audit scripts/docs.

### DO-NOT-CHANGE (until blockers fixed)
- Do not expand sitemap coverage or publish new longtail slices.
- Do not introduce new indexable URL patterns.

## Post-launch UI Fixes (Non-breaking)

- Restored short job description/snippet on homepage job cards
- Improved job card readability and spacing
- Added emoji-based visual cues (salary, location, remote, featured)
- No changes to URLs, slugs, canonicals, or sitemaps

- Homepage now renders JobCardV2 via app/components/JobList.tsx (no routing or SEO changes)
- Added shared emoji helper (lib/ui/emoji.ts) for consistent UI cues
- Updated job detail UI (app/job/[slug]/page.tsx) to align with new job card styling and emojis

---

## v2.9 – Authority, AI Refinement & Ranking Expansion (Planned)

### Scope
- Transform raw ATS job data into concise, authoritative, AI-refined content
- Improve readability, scannability, and user trust without changing URLs or index rules

### Job Detail Page Enhancements
- AI-refined role overview (3–5 sentences)
- Clean, deduplicated responsibilities list
- Simplified hard requirements section
- Minimized and structured benefits & perks
- “Why this job pays $100k+” explanation derived from role, seniority, and market demand

### Homepage & Job Cards
- Restored and enhanced short job descriptions/snippets
- Emoji-based visual cues for salary, location, remote status, and featured roles
- Improved spacing, hierarchy, and readability
- No impact to routing, slugs, or SEO canonicals

### Skill & Data Intelligence
- Surface top skills per role and per job
- Highlight skills correlated with six-figure compensation
- Enable future ranking for skill + salary combinations

### Company & Trust Signals
- Hiring momentum indicators (recent postings, active hiring)
- Remote-friendliness and growth signals derived from data
- No speculative claims or user-generated content

### Editorial Authority (Tier-1 Roles Only)
- Short role primers explaining:
  - What the role does
  - Why it commands six-figure pay
  - Skills and experience that matter most
- Applied only to Tier-1 roles to avoid index bloat

### Explicit Non-Goals
- No URL, slug, canonical, sitemap, or routing changes
- No blog content or forums
- No user accounts or filters expansion

