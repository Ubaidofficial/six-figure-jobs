# 2.8.51 (2026-05-05)


### Features

* add Google Indexing API OAuth2 client with refresh token auth, POST /api/indexing/notify endpoint for fast job indexing after scraping, one-time OAuth2 setup script, and lastmod timestamps on sitemap-browse.xml


# 2.8.50 (2026-05-03)


### Bug Fixes

* prioritize live job cards on the homepage and refresh pSEO/GEO copy around verified salary ranges, direct apply links, and crawlable job hubs
* strengthen pSEO guardrails for country, company, companies, and remote pages with richer structured data, FAQ content, and verified salary-range copy
* enrich company pSEO templates with role mix, salary bands, work setup, top locations, and company-specific structured data keywords


# 2.8.49 (2026-04-26)


### Bug Fixes

* upgrade the main jobs and remote pSEO hubs with richer server-rendered content, live public count alignment, shared category definitions, and stronger collection/list structured data
* harden board and ATS ingestion by adding SmartRecruiters, Recruitee, Workable, and Workday support, switching Lever to the public postings API, and adding repair scripts for stale ATS and board-derived company mappings


# 2.8.48 (2026-04-17)


### Bug Fixes

* retire stale canonical job-detail URLs as 404s, stop alias routes from redirecting stale jobs, and teach the GSC classifier to treat stale-job 404s as expected cleanup


# 2.8.47 (2026-04-16)


### Bug Fixes

* retry transient `5xx` proof failures and likely incomplete streamed HTML before failing canonical checks so scheduled production SEO proofing stops flaking on healthy pages
* raise per-URL retry budget in the daily scrape production proof step and cover the new retry heuristics with Jest tests


# 2.8.46 (2026-04-15)


### Bug Fixes

* tighten job `JobPosting` schema for remote roles so `TELECOMMUTE` is only emitted when applicant geography can be supported, and infer applicant location requirements from normalized remote location text when available


# 2.8.45 (2026-04-15)


### Bug Fixes

* strengthen category, level, and companies pSEO templates with richer metadata, structured data, and safer companies-directory metadata fallback/noindex behavior


# 2.8.44 (2026-04-15)


### Bug Fixes

* refresh `baseline-browser-mapping` to the latest available release so local and CI builds use the newest shipped baseline dataset available from upstream


# 2.8.43 (2026-04-15)


### Bug Fixes

* align the daily scrape artifact upload step with the current official `actions/upload-artifact@v7` usage so the workflow tracks the supported GitHub-hosted runner major


# 2.8.42 (2026-04-15)


### Bug Fixes

* cut duplicate live-page fetches from strict SEO validation, add transient per-URL retries, and shorten whole-run proof retries so production SEO proofing stops timing out on random body-read aborts


# 2.8.41 (2026-04-15)


### Bug Fixes

* upgrade the daily scrape log upload step to `actions/upload-artifact@v6` so the workflow stops emitting the remaining Node 20 action deprecation warning


# 2.8.40 (2026-04-15)


### Bug Fixes

* remove browse sitemap ownership of plain city hubs and remote role hubs so dedicated sitemap families stop publishing duplicate URLs in production SEO proofing
* teach Jest the app `@/` alias and refresh the company sitemap route test mock so the SEO test suite matches the current route implementations again


# 2.8.39 (2026-03-31)


### Bug Fixes

* add shared job freshness gating plus a scrape health guard so stale ATS inventory stops flowing into listings, sitemaps, and indexable job pages
* remove the stale `isHighSalaryLocal` Prisma field and switch salary-based scripts back to the live salary flags so production scrape jobs stop failing on schema drift


# 2.8.38 (2026-03-26)


### Bug Fixes

* normalize `/search` query parameters onto a single canonical lowercase URL variant so mixed-case searches stop splitting into inconsistent live responses
* add explicit `no-store` cache headers for `/search` so dynamic search results are never served from stale edge cache


# 2.8.37 (2026-03-26)


### Bug Fixes

* make internal job search case-insensitive so obvious role queries like `software engineer` stop returning false empty states
* restrict `JobPosting` salary markup to ATS-backed salaries only and stop inventing applicant geography for unknown or global remote roles
* re-scope company pages and company sitemap eligibility to the same qualifying live-job universe used by the board instead of all non-expired jobs


# 2.8.36 (2026-03-26)


### Bug Fixes

* align `/remote` hub counts and role links with the same freshness and indexability rules used by `/remote/[role]` so the hub no longer promotes empty remote role pages
* return `404` for empty optional sitemap families (`remote`, `country`, `slices`) instead of serving empty `200` XML documents that create persistent GSC sitemap errors


# 2.8.35 (2026-03-25)


### Bug Fixes

* remove invented sitemap freshness hints and placeholder fallback URLs so sitemap families only emit accurate crawl signals during normal operation and outages
* tighten `JobPosting` JSON-LD to stop fabricating `validThrough`, preserve cleaned HTML descriptions, and normalize employment type/location markup for Google job ingestion


# 2.8.34 (2026-03-25)


### Bug Fixes

* add Railway production diagnosis tooling for deploy state, Prisma connectivity, schema presence, and migration verification during live incidents
* rewrite deployment docs to treat Railway as the authoritative production path and remove the misleading VPS-first quick start


# 2.8.33 (2026-03-25)


### Bug Fixes

* harden salary tier, role, remote role, search, company, and job routes so Prisma/query failures render controlled fallback pages and metadata instead of server-side digest crashes
* split job listing queries into lighter default selects and add runtime fallback presets plus segment error boundaries for jobs and remote routes
* require `prisma migrate deploy` in the production deploy path and add a production smoke check script for core jobs and remote pages


# 2.8.32 (2026-03-16)


### Bug Fixes

* add explicit canonical tags to `/about`, `/privacy`, `/terms`, and `/salary` so fallback sitemap targets satisfy strict production SEO proof checks


# 2.8.31 (2026-03-16)


### Bug Fixes

* add runtime fallbacks for the homepage, jobs hub, remote hub, and companies hub so production keeps serving stable indexable pages when Prisma cannot reach Railway
* harden DB-backed sitemap families (`jobs`, `company`, `salary`, `category`, `level`, `browse`) with explicit fallback XML responses instead of live 500s during database outages


# 2.8.30 (2026-03-16)


### Bug Fixes

* harden `sitemap.xml` and `robots.txt` so optional city/remote/country/slices sitemap failures degrade to a 200 response instead of taking production SEO endpoints down
* add explicit fallback markers plus regression coverage for optional sitemap family failures so production route degradation is observable without breaking sitemap discovery


# 2.8.29 (2026-03-16)


### Bug Fixes

* self-canonicalize query-parameter listing states and force filtered jobs/remote utility views to `noindex,follow` instead of pointing canonicals at the unfiltered hub
* remove empty salary tiers from page robots and `sitemap-salary.xml`, and add regression coverage for salary-tier gating
* use live query counts for slice pagination prev/next tags and for fallback slice synthesis guards so pSEO URLs stay aligned with real page eligibility
* force remote-only filters on remote role and remote role-by-country pages so `/remote/*` routes do not leak non-remote jobs


# 2.8.28 (2026-03-16)


### Bug Fixes

* split the daily scrape workflow from the production SEO proof so scrape failures are not conflated with public-site health failures
* make production sitemap/SEO workflow targets configurable via `PRODUCTION_SITE_URL`
* improve sitemap validator error output with HTTP status, content type, and response body snippets for faster production debugging


# 2.8.27 (2026-03-09)


### Bug Fixes

* fix daily scraper SEO guard workflow command to use strict validator defaults instead of an invalid strict/sample combination
* omit `sitemap-country.xml` from `sitemap.xml` and `robots.txt` when country pages are below indexable threshold
* add shared country sitemap availability helper and regression coverage for country sitemap inclusion gates


# 2.8.26 (2026-03-01)


### Bug Fixes

* omit `sitemap-remote.xml` and `sitemap-slices.xml` from `sitemap.xml`/`robots.txt` when those families have zero URL entries to prevent empty-child sitemap integrity failures
* add remote/slices sitemap availability helpers and regression coverage for conditional sitemap index + robots declarations
* archive legacy salary debug/cleanup variants and remove obsolete `dailyScrape.ts` entrypoint
* repoint board-specific npm scrape commands to `dailyScrapeV2` so package scripts no longer reference missing files


# 2.8.25 (2026-03-01)


### Bug Fixes

* consolidate country-family canonical URLs to `/jobs/location/*` and remove duplicate country URL emission from browse sitemap generation
* add role-filter robots indexability gate (`MIN_ROLE_FILTER_INDEXABLE_JOBS`) and regression coverage to prevent thin salary filter pages from being indexed too early
* add production noindex guard step in daily scrape workflow and publish a dedicated GSC-safe pSEO publishing guide


# 2.8.24 (2026-02-27)


### Bug Fixes

* add a strict pSEO playbook batch generator that supports 12 playbook types and enforces slug/intent/keyword uniqueness with cannibalization checks
* add CLI dataset-driven batch generation command with machine-readable `OK`/`SKIPPED` JSON outputs and batch-level validation gates
* add example dynamic dataset for safe large-scale pSEO page generation and internal linking rule compliance


# 2.8.23 (2026-02-26)


### Bug Fixes

* add `scripts/classify-gsc-urls.ts` to classify GSC URL exports by live HTTP, canonical/noindex, sitemap presence, and DB state
* emit JSON + TSV audit outputs for evidence-based indexing triage without manual URL-by-URL checks


# 2.8.22 (2026-02-24)


### Bug Fixes

* align remote role page robots gating and remote sitemap inclusion using shared indexability thresholds
* make remote role queries/sitemap use consistent filter semantics to prevent empty thin remote role URLs from being indexed
* add regression coverage for remote role indexability gate alignment between page and sitemap routes


# 2.8.21 (2026-02-18)


### Bug Fixes

* reduce homepage client-side JavaScript by moving hero search and role filtering controls to server-rendered form/select markup
* replace homepage latest-opportunity cards with server-rendered markup and explicit company logo alt text
* shorten homepage title tag to reduce SERP truncation risk
* remove unused layout ThemeProvider wrapper to cut shared client bundle overhead


# 2.8.20 (2026-02-16)


### Bug Fixes

* move scheduled scrape/ingest pipeline from Railway trigger calls to direct GitHub Actions execution with workflow_dispatch controls
* add daily scraper dry-run + source/concurrency/ATS-limit CLI controls and fix `--mode=value` parsing
* enforce dry-run no-write behavior across ingest company upsert, job create/update paths, and CompanyATS discovery upserts
* add dry-run guard tests for company upsert + CompanyATS persistence
* document scrape, SEO gate, and deployment commands in README


# 2.8.19 (2026-02-15)


### Bug Fixes

* align company/city/country sitemap inclusion with page robots thresholds via shared indexability gates
* switch city/country sitemap counts to page-equivalent query filters to prevent noindex URLs from entering sitemaps
* add CI-grade SEO gates workflow for PR local validation and main-branch production proof retries
* add targeted sitemap threshold tests for city/country and alignment coverage for company/city/country gates
* fix CI checkout depth so changelog gate can diff HEAD~1...HEAD on pull requests
* add scripts/audit-v2.9.ts so CI audit step references a real, deterministic script
* make SEO local gate use isolated Postgres service + prisma db push for reproducible startup validation
* make company sitemap index/page return valid XML in zero-data scenarios instead of emitting 404 shard URLs
* include slice sitemap children in sitemap-slices index only when shard has at least one URL entry
* harden sitemap health check so index-listed child sitemaps with zero loc entries fail deterministically
* run sitemap health workflow against local app on pull requests while keeping scheduled production checks
* seed deterministic sitemap fixture data in PR health workflow to avoid false failures from empty test databases


# 2.8.18 (2026-02-14)


### Bug Fixes

* harden sitemap integrity and strict validation (canonical/indexable/non-redirecting URL checks)
* enforce centralized job indexability quality gate in job sitemap and job page robots logic
* add duplicate-control checks across sitemap buckets and template sanity sampling reports
* make city sitemap fallback observable and test XML well-formedness under failure and normal paths
* tighten salary parsing/validation edge cases and add fixture coverage for threshold + dedupe behavior


# 2.8.17 (2026-02-13)


### Bug Fixes

* cap Prisma connection pool size and add pool timeout to reduce P2037 errors


# 2.8.16 (2026-02-13)


### Bug Fixes

* force dynamic rendering for sitemap routes to avoid build-time DB connections


# 2.8.15 (2026-02-12)


### Bug Fixes

* avoid false S$ currency detection and infer USD when $ + US context is present
* generalize apply URL enrichment to extract external apply links across board sources
* re-enable Remote100k job scraping in the daily board pipeline
* fix WWR scraper type reference for Cheerio v1 builds
* normalize metadataBase to shared site URL helper and remove static job counts
* wait for scrape pipeline completion in daily GitHub Action
* add cache headers for sitemaps/pages and disable Next image optimization to reduce Railway usage
* move scrape pipeline to GitHub Actions and remove Puppeteer from production dependencies
* fix invalid sitemap header route pattern in Next config


# 2.8.14 (2026-02-11)


### Bug Fixes

* add BuiltIn detail-page salary extraction with JSON-LD fallback
* capture explicit salary chips on WeWorkRemotely listings only when present


# 2.8.13 (2026-02-10)


### Bug Fixes

* remove estimated salary injection in WWR, BuiltIn, and YC scrapers


# 2.8.12 (2026-02-09)


### Bug Fixes

* omit city sitemap from index/robots when empty


# 2.8.12 (2026-02-09)


### Bug Fixes

* omit city sitemap from index/robots when empty


# 2.8.11 (2026-02-09)


### Bug Fixes

* stop remotive salary estimates and board salary text fallbacks
* only show salary verified for ATS sources and avoid default mid-level labels


# 2.8.10 (2026-02-09)


### Bug Fixes

* allow nullable country codes in salary threshold helpers


# 2.8.9 (2026-02-09)


### Bug Fixes

* fix eslint globals and cleanup directives in node scripts


# 2.8.8 (2026-02-09)


### Bug Fixes

* localize salary threshold labels across PSEO pages
* fix salary band filtering with currency inference and local thresholds
* seed USD band slices with explicit currency and localize role+country slices


# 2.8.7 (2026-02-06)


### Bug Fixes

* add automated sitemap health checks and URL sampling guardrails


# 2.8.6 (2026-02-06)


### Bug Fixes

* parse Greenhouse salary metadata and decode currency symbols
* infer country code for Greenhouse salary parsing
* expand salary coverage audit and add indexing/sitemap verification scripts


# 2.8.5 (2026-02-05)


### Bug Fixes

* harden sitemap indexing (lastmod accuracy, company shards, slice dedupe)
* refine location normalization and backfill cleanup for invalid city slugs
* add sitemap audit utilities for duplication and coverage checks


# 2.8.4 (2026-02-01)


### Bug Fixes

* count city sitemap entries by citySlug only and include longtail slice index
* add city sitemap coverage audit script


# 2.8.3 (2026-01-28)


### Bug Fixes

* seed role slices in pipeline and restrict priority slice sitemap to high-count role pages
* run additional slice seeders (salary bands + country salary) after scrapes
* lower priority slice threshold to 10 jobs to populate sitemap
* dedupe priority slice sitemap URLs by canonical path


# 2.8.2 (2026-01-27)


### Bug Fixes

* persist scrape run status in DB for reliable polling
* return 410 for expired legacy job alias URLs
* include priority slice sitemap in index/robots


# 2.8.1 (2026-01-08)


### Bug Fixes

* convert soft redirects to HTTP 308
* exclude noindex pages from company/city/country/level/category sitemaps
* update route handler params typing for Next
* add `npm run typecheck` script
* support `CRON_SECRET_NEXT` for rotation
* don't fail full scrape when AI enrichment fails
* fix Prisma groupBy orderBy count in AI enrichment selection
* timeout AI enrichment in full pipeline


# 1.0.0 (2026-01-06)


### Bug Fixes

* exclude low-quality pages from sitemap-browse.xml
* avoid dynamic route conflict by using /jobs/[role]/city/[city] ([06cf45c](https://github.com/Ubaidofficial/six-figure-jobs/commit/06cf45c644fe6a51693b487f6317a0f8083cbc48))
* **build:** exclude scripts and prisma from TypeScript build ([c3eb04f](https://github.com/Ubaidofficial/six-figure-jobs/commit/c3eb04f2a8e1f3adba88bca9cd468d8543fe74b6))
* canonical 308 redirects, quiet logs behind DEBUG flags, move apex->www to next redirects ([bea8c71](https://github.com/Ubaidofficial/six-figure-jobs/commit/bea8c712c50cf6b0c63ffb28a60eccb1d0a377bd))
* **changelog:** add security notes [PRD-3 Task 1] ([bf615f1](https://github.com/Ubaidofficial/six-figure-jobs/commit/bf615f1b109e17bc933a7ebbb93b7513e48ff4b2))
* **changelog:** note PRD-2 SEO changes ([b9cea26](https://github.com/Ubaidofficial/six-figure-jobs/commit/b9cea26378da1ef936ee7ef9d1eb9c1030072133))
* clean remote filters and metadataBase warning ([b779f1e](https://github.com/Ubaidofficial/six-figure-jobs/commit/b779f1ece3c8c1e9c27e9921f6c5ed0dfd1089e5))
* complete systematic fixes for scrapers and code quality ([f5c05b0](https://github.com/Ubaidofficial/six-figure-jobs/commit/f5c05b08738e454eb2606bc2bf8e970fa721250e))
* deepseek AI annotator + prisma pooling + remote role page revalidate ([a714264](https://github.com/Ubaidofficial/six-figure-jobs/commit/a7142642e668613176d40f17f10eb2a1972be8bc))
* define totalJobs in remote role/city page ([6e42cb6](https://github.com/Ubaidofficial/six-figure-jobs/commit/6e42cb6ac5fe3953d0b966f0e7ea59c137a61bea))
* define totalJobs in remote role/city page ([bc6bcf3](https://github.com/Ubaidofficial/six-figure-jobs/commit/bc6bcf3ea97abcf83503ddab44655c4d782d109a))
* disable Remote100k scraper (13 bad jobs removed) ([99521eb](https://github.com/Ubaidofficial/six-figure-jobs/commit/99521eb9b4ab2396d3324708802a112dc4e8d9a5))
* enforce annual-only salary display and prevent low/monthly leaks ([c804808](https://github.com/Ubaidofficial/six-figure-jobs/commit/c804808731ff2c2ef65418fe773cd364bb4fb9ba))
* enhance main JobCard with primaryLocation and aiSnippet ([84e5de4](https://github.com/Ubaidofficial/six-figure-jobs/commit/84e5de49ca40272d8d1469787bcdae7d0dbe6225))
* extract real employer apply URLs from remote100k job pages ([9f8a6c5](https://github.com/Ubaidofficial/six-figure-jobs/commit/9f8a6c5a2ff8e54bf789595d5e57aa3e2347770e))
* filter job sitemaps to salary-validated jobs only ([bd7a4bf](https://github.com/Ubaidofficial/six-figure-jobs/commit/bd7a4bf768dc7321ca09ec5eed47b542f6d6c494))
* greenhouse salary parser + salary outlier caps + needsReview field ([d93830e](https://github.com/Ubaidofficial/six-figure-jobs/commit/d93830e8a9284b840e2b5b26ab4033b43174ac5b))
* GSC optimization (segments 1,3,4) - sitemaps, scrapers, meta tags ([3c47b95](https://github.com/Ubaidofficial/six-figure-jobs/commit/3c47b953379382658d9a889a5e7b54ca782a09e8))
* harden job routing + remote100k scraper cleanup ([4186f0b](https://github.com/Ubaidofficial/six-figure-jobs/commit/4186f0b04eb159dcf871c16888c4eff915ae95f2))
* **home:** restore job card snippets + emoji meta ([1f3ada2](https://github.com/Ubaidofficial/six-figure-jobs/commit/1f3ada225728d4c66bc8f562de9f13bb8331d1a0))
* improve location parsing to handle Remote-Friendly prefix ([2d3e5fd](https://github.com/Ubaidofficial/six-figure-jobs/commit/2d3e5fdb5a61e70ef1f6e944a8bc3e02487a3e2e))
* **ingest:** ensure shortId set during deep discovery job creation ([2658289](https://github.com/Ubaidofficial/six-figure-jobs/commit/26582896654d8baa819861dba70893d1ac1af397))
* **jsonld:** plain-text JobPosting description + safe salary normalization ([e5acf18](https://github.com/Ubaidofficial/six-figure-jobs/commit/e5acf185cef5f164109179ccd5f6b15958d0133a))
* **jsonld:** use canonical job URLs in ItemList (avoid redirects) ([732c9b4](https://github.com/Ubaidofficial/six-figure-jobs/commit/732c9b4bc4c3b6f688765e8fb5ea55dc9787b128))
* **location:** normalize locationRaw bullets + tighten multi-location detection ([4114fbf](https://github.com/Ubaidofficial/six-figure-jobs/commit/4114fbf7945deb3f6007907e86fa2baa9a7a24b7))
* **location:** repair board remote flags + audit deltas ([9f63b18](https://github.com/Ubaidofficial/six-figure-jobs/commit/9f63b188a484149840854bbc59a99714298110e1))
* move role+city route under /jobs/[role]/city/[city] to avoid conflict ([21a7a2e](https://github.com/Ubaidofficial/six-figure-jobs/commit/21a7a2e110e3660e082eaf1bed0b36ea01837571))
* normalize JobCard currency undefined to null ([5638553](https://github.com/Ubaidofficial/six-figure-jobs/commit/5638553877913237610900d2bd880e344e3dd7e9))
* pass currency into JobCardV2 from JobList ([7aff39e](https://github.com/Ubaidofficial/six-figure-jobs/commit/7aff39e4f47d89399842906df8649833ce18d9a8))
* PPP-adjusted queries, real counts, emojis, Germany €80k+ ([c7d39b7](https://github.com/Ubaidofficial/six-figure-jobs/commit/c7d39b79e49aeab19fd58f0add072552ce1d44ff))
* PRD-4 to PRD-7 Phase 4 fixes complete ([963014b](https://github.com/Ubaidofficial/six-figure-jobs/commit/963014b7d5cfe476b95bd440c8218684b0d64f15))
* **prisma:** prevent build-time connection exhaustion + stabilize level pages ([0f95858](https://github.com/Ubaidofficial/six-figure-jobs/commit/0f958587207d00ca7d99219aa6c657e362315e4a))
* remove invalid optimizeFonts key from next.config ([2860403](https://github.com/Ubaidofficial/six-figure-jobs/commit/2860403f54ad229e3cbd3a9f9938e8041a7d4ca5))
* remove Job.slug references and rely on buildJobSlugHref ([ac624c6](https://github.com/Ubaidofficial/six-figure-jobs/commit/ac624c6bb72ebb1b4b347495b8ad57d1c8f1a4b3))
* Remove unsupported fields from YC scraper ([fb34a95](https://github.com/Ubaidofficial/six-figure-jobs/commit/fb34a9519003bfb4f9d13043e7a8770d8fe0c5c4))
* Repair syntax errors in generic.ts scraper ([41ba3a3](https://github.com/Ubaidofficial/six-figure-jobs/commit/41ba3a3c6ecc8c7990845c4e82ad8b1a7dfb33e4))
* resolve double flag display in job location labels (🇺🇸 USA instead of 🇺🇸 🇺🇸 USA) ([9c55e4b](https://github.com/Ubaidofficial/six-figure-jobs/commit/9c55e4beedea0675c7c9db19acb2cf6f78842ef6))
* resolve race condition in job ingestion ([bd7ea9b](https://github.com/Ubaidofficial/six-figure-jobs/commit/bd7ea9b4d8cc8a500a02a10a909375f43ae250b2))
* **routes:** use numeric revalidate literals for Next route handlers ([cbe4cfa](https://github.com/Ubaidofficial/six-figure-jobs/commit/cbe4cfab6e6555372106943399a8a7b83aa73a15))
* run AI enrichment in background to avoid timeout ([45a7272](https://github.com/Ubaidofficial/six-figure-jobs/commit/45a7272aa6ad799584302d01a82239039864a377))
* **scrapers:** add no-fabricated-salary guardrail [PRD-1 Task 4] ([b8db1bb](https://github.com/Ubaidofficial/six-figure-jobs/commit/b8db1bb3a60ae07abadbe496c16b7cf101363ad3))
* **scrapers:** remove JustJoin USD currency fallback [PRD-1 Task 3] ([c83798b](https://github.com/Ubaidofficial/six-figure-jobs/commit/c83798bd53aba5864ea0f26c6e84105ae24be9ac))
* **scrapers:** remove RemoteOK salary fabrication [PRD-1 Task 1] ([32223b6](https://github.com/Ubaidofficial/six-figure-jobs/commit/32223b651886fca1c077669156b5b8ae1ab37425))
* **scrapers:** remove RemoteRocketship salary fabrication [PRD-1 Task 2] ([9ad4cd6](https://github.com/Ubaidofficial/six-figure-jobs/commit/9ad4cd6c76827c4fabeeed55ea9f7920713f4e43))
* **security:** ai-enrich Bearer auth [PRD-3 Task 2] ([0967b6d](https://github.com/Ubaidofficial/six-figure-jobs/commit/0967b6da38f5c78a118c468ece9695c225fc103b))
* **security:** block SSRF in generic scraper [PRD-3 Task 5] ([9d8be9a](https://github.com/Ubaidofficial/six-figure-jobs/commit/9d8be9a732e4f78c33169b55794fa976b007bd5b))
* **security:** protect /api/scrape Bearer auth [PRD-3 Task 1] ([6b8ec81](https://github.com/Ubaidofficial/six-figure-jobs/commit/6b8ec814e143b5c2fc4035c66eb2e9a06517f333))
* **security:** redact CRON_SECRET in claude rules [PRD-3 Task 4] ([19cd8eb](https://github.com/Ubaidofficial/six-figure-jobs/commit/19cd8ebc032476b1dd149d06cabff44c1d68510e))
* **security:** redact CRON_SECRET in SEO_SPEC [PRD-3 Task 3] ([3bcf7b4](https://github.com/Ubaidofficial/six-figure-jobs/commit/3bcf7b4ddb9ef5330d827bdd84179723fe2d1ce6))
* **seo:** add /jobs slice route [PRD-2 Task 5] ([ca798b9](https://github.com/Ubaidofficial/six-figure-jobs/commit/ca798b9c52411c73554a3460dfbc675ce8b2436b))
* **seo:** align slice seed/canonical country slugs [PRD-2 Task 4] ([8c06759](https://github.com/Ubaidofficial/six-figure-jobs/commit/8c067595b915187f4cccbed5136ca85f766d986e))
* **seo:** enforce tier robots on /jobs/[role] [PRD-2 Task 3] ([65b9185](https://github.com/Ubaidofficial/six-figure-jobs/commit/65b918577473d9c7e8bd355e05ce0a1ba9e8154f))
* **seo:** location invalid slugs 404 [PRD-2 Task 2] ([fc748bf](https://github.com/Ubaidofficial/six-figure-jobs/commit/fc748bfc31d6fb2147a2704474df3e7d4763cc43))
* **seo:** normalize JobPosting JSON-LD description and salary values ([55e14ae](https://github.com/Ubaidofficial/six-figure-jobs/commit/55e14ae47cb8052d2ee36afe6e07923d42eaef49))
* **seo:** remove redirects from sitemap-browse [PRD-2 Task 1] ([7f3344b](https://github.com/Ubaidofficial/six-figure-jobs/commit/7f3344b9d536b6e140887bc81b33133eddfec2c7))
* **seo:** v2.8 job slugs, canonical redirects, job page UI + salary restore ([ba98105](https://github.com/Ubaidofficial/six-figure-jobs/commit/ba981058b5886883005bb40476a51cf5c5aac41d))
* show full job description alongside AI highlights ([02b1771](https://github.com/Ubaidofficial/six-figure-jobs/commit/02b177189af033bd7e2191eb1e411d9b844301ef))
* show full job description alongside AI highlights ([9c247f0](https://github.com/Ubaidofficial/six-figure-jobs/commit/9c247f05cfa2bf1ba5b08c17b066a573efbca344))
* Show latest jobs by scrape date (createdAt) instead of post date (postedAt) ([2332257](https://github.com/Ubaidofficial/six-figure-jobs/commit/2332257c3b8bbca44a249b5b0dffa4c94e3fe5ea))
* **sitemaps:** emit only canonical v2.8 job URLs ([34241d8](https://github.com/Ubaidofficial/six-figure-jobs/commit/34241d8ca36c90595385329231d90c1d716c1bb1))
* **sitemaps:** force-dynamic to avoid DB access during build ([b425b2f](https://github.com/Ubaidofficial/six-figure-jobs/commit/b425b2fb00c7b1ad35cba8274a0a553e0030072a))
* **snippet:** prevent company-bio text from job card snippet ([51a9188](https://github.com/Ubaidofficial/six-figure-jobs/commit/51a91889f7d842ae9e7722b6f60a2e51db5007da))
* standardize all URLs to www.6figjobs.com for SEO consistency ([7db63cd](https://github.com/Ubaidofficial/six-figure-jobs/commit/7db63cda56c63e7c338382a796f7805a6a34cc9a))
* **trust:** add about/privacy/terms/cookies pages and update footer links ([6b273fb](https://github.com/Ubaidofficial/six-figure-jobs/commit/6b273fb389e2fd91f337378101be610c02089431))
* unify AI enrichment pipelines, improve extraction quality ([e6d3fd3](https://github.com/Ubaidofficial/six-figure-jobs/commit/e6d3fd3f527e50ae404f5ad0faaccc54f336f9e5))
* use DEEPSEEK_API_KEY instead of OPENAI_API_KEY ([522f8af](https://github.com/Ubaidofficial/six-figure-jobs/commit/522f8af0d03370883d1de24b4588e8fc1d11709e))
* use tsx instead of ts-node for AI enrichment script execution ([0a9310f](https://github.com/Ubaidofficial/six-figure-jobs/commit/0a9310f88cb181fade6b66cca3fb06d63f8dea7f))
* **v2.9:** align backfill script with Prisma salary quality fields and types ([9bae481](https://github.com/Ubaidofficial/six-figure-jobs/commit/9bae481b7c9ccc25fa18eda7a700256825d4ba35))
* **v2.9:** centralize salary gating + banned-title helper ([829ddd6](https://github.com/Ubaidofficial/six-figure-jobs/commit/829ddd62a9aa65c3cc4395098a672aa3dab7cb24))
* **v2.9:** enforce salaryValidated gating on remote role pages ([76d6f96](https://github.com/Ubaidofficial/six-figure-jobs/commit/76d6f969aee625ed7c551ae3eb86da4d92e1c49c))


### Features

* add logging to AI enrichment API and inherit stdio ([43fb59f](https://github.com/Ubaidofficial/six-figure-jobs/commit/43fb59f9d9b9ccaf6e88bb1e0695e0a4dbc4d292))
* Add strategic AI enrichment and location parsing to scraping pipeline ([9ac3e13](https://github.com/Ubaidofficial/six-figure-jobs/commit/9ac3e13afce6e155dab0bb66a16357298c0742ab))
* add WebSite and Organization schemas to homepage ([70607ab](https://github.com/Ubaidofficial/six-figure-jobs/commit/70607ab1148ce47ae54235e8dcd0ce0ef6089851))
* auto-enrich apply URLs after daily scrape ([2d5a542](https://github.com/Ubaidofficial/six-figure-jobs/commit/2d5a5421de608a5d592c8d70f89f42257cebc6cc))
* complete scraper improvements and company discovery ([93c9f2a](https://github.com/Ubaidofficial/six-figure-jobs/commit/93c9f2a645621584455a1417e696184727761863))
* critical SEO fixes + publishing safety (Phase 1) - Add metadataBase, Twitter metadata, keyword optimization, publishing safety gates, real tracking, quality validation, rollback plan, test route noindex - PSEO_ENABLED=false, ultra-conservative rates for new domain - Audit compliance 90% to 98%, Publishing safety 3/8 to 8/8 - TypeScript: 0 errors ([15e4e1f](https://github.com/Ubaidofficial/six-figure-jobs/commit/15e4e1fa83ff71c7258e60a41037b8efc41584d8))
* enhance job cards with primaryLocation, aiSnippet, and experience levels ([9134b6d](https://github.com/Ubaidofficial/six-figure-jobs/commit/9134b6df4eaf35c12a50843788da8dcf8e145908))
* enhance job cards with prominent tech stack display ([00e095a](https://github.com/Ubaidofficial/six-figure-jobs/commit/00e095a30a39bfd581aba7889d205d97524fafde))
* enhanced AI structuring and tech stack filtering ([06048d2](https://github.com/Ubaidofficial/six-figure-jobs/commit/06048d24150c3e8ee1d908836657c8f1b3efbead))
* expand footer to 13 SEO-rich sections with 70+ internal links ([8576a30](https://github.com/Ubaidofficial/six-figure-jobs/commit/8576a307db50153f177e1c79d4b8c79cc99acd85))
* implement AI enrichment display and Six Figure branding ([a175bcc](https://github.com/Ubaidofficial/six-figure-jobs/commit/a175bccadae221314c2401d84168998ed89de358))
* implement shadcn/ui with Six Figure Jobs dark theme ([3cab8f4](https://github.com/Ubaidofficial/six-figure-jobs/commit/3cab8f40adcd941693eb7662a6655e7602970a67))
* implement tech stack extraction and backfill ([15ae0db](https://github.com/Ubaidofficial/six-figure-jobs/commit/15ae0dbebf4c508739164b5b85731f17d822cbc5))
* infinite scroll + new green brand color + apply URL enrichment ([2fd36a9](https://github.com/Ubaidofficial/six-figure-jobs/commit/2fd36a95fde985178f96f98ef0647b371aa92721))
* **jobs:** permanent canonical redirects + shortId-backed job slugs ([06b72de](https://github.com/Ubaidofficial/six-figure-jobs/commit/06b72de0a560789232890d6640a5a04e8c0522ea))
* major UI/UX improvements - navigation, job cards, AI enrichment, shadows ([40378a1](https://github.com/Ubaidofficial/six-figure-jobs/commit/40378a1b9a249007f9c64056a8e669d6eeec68fc))
* migrate scraper to Railway API (no DB in GitHub Actions) ([b2546ef](https://github.com/Ubaidofficial/six-figure-jobs/commit/b2546ef62c976f20c63771f1530e95aa16cb8d48))
* optimize first paragraphs with primary keywords ($100k, high paying, six figure) ([61f7edb](https://github.com/Ubaidofficial/six-figure-jobs/commit/61f7edb3ada0f41d8e4a5294a08fcdc8f288356b))
* **seo:** canonical role slugs + remove 150k tier ([f9203ef](https://github.com/Ubaidofficial/six-figure-jobs/commit/f9203efc996748fc0fcbe83487920b17e2ec9078))
* **seo:** implement v1.5 rules - 90% compliance ([5c7a9cf](https://github.com/Ubaidofficial/six-figure-jobs/commit/5c7a9cf81baae556738c9b59e2c3b9323741bab2))
* **ui:** upgrade job cards, emojis, and job detail layout ([a37c06f](https://github.com/Ubaidofficial/six-figure-jobs/commit/a37c06f3d9c7e35508569698e7f0356ea4b594b5))

* pause AI enrichment via AI_ENRICHMENT_PAUSED flag

* fix: hoist startLocation to avoid TS use-before-declare

* fix: hoist startLocation to avoid TS use-before-declare

* fix: hoist startLocation to avoid TS use-before-declare

* force node runtime for cron routes + add /api/cron/_debug-env
