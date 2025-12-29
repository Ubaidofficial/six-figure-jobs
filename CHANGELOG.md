# 1.0.0 (2025-12-21)


### Bug Fixes

* avoid dynamic route conflict by using /jobs/[role]/city/[city] ([06cf45c](https://github.com/Ubaidofficial/six-figure-jobs/commit/06cf45c644fe6a51693b487f6317a0f8083cbc48))
* **build:** exclude scripts and prisma from TypeScript build ([c3eb04f](https://github.com/Ubaidofficial/six-figure-jobs/commit/c3eb04f2a8e1f3adba88bca9cd468d8543fe74b6))
* canonical 308 redirects, quiet logs behind DEBUG flags, move apex->www to next redirects ([bea8c71](https://github.com/Ubaidofficial/six-figure-jobs/commit/bea8c712c50cf6b0c63ffb28a60eccb1d0a377bd))
* **changelog:** add security notes [PRD-3 Task 1] ([bf615f1](https://github.com/Ubaidofficial/six-figure-jobs/commit/bf615f1b109e17bc933a7ebbb93b7513e48ff4b2))
* **changelog:** note PRD-2 SEO changes ([b9cea26](https://github.com/Ubaidofficial/six-figure-jobs/commit/b9cea26378da1ef936ee7ef9d1eb9c1030072133))
* clean remote filters and metadataBase warning ([b779f1e](https://github.com/Ubaidofficial/six-figure-jobs/commit/b779f1ece3c8c1e9c27e9921f6c5ed0dfd1089e5))
* deepseek AI annotator + prisma pooling + remote role page revalidate ([a714264](https://github.com/Ubaidofficial/six-figure-jobs/commit/a7142642e668613176d40f17f10eb2a1972be8bc))
* define totalJobs in remote role/city page ([6e42cb6](https://github.com/Ubaidofficial/six-figure-jobs/commit/6e42cb6ac5fe3953d0b966f0e7ea59c137a61bea))
* define totalJobs in remote role/city page ([bc6bcf3](https://github.com/Ubaidofficial/six-figure-jobs/commit/bc6bcf3ea97abcf83503ddab44655c4d782d109a))
* enforce annual-only salary display and prevent low/monthly leaks ([c804808](https://github.com/Ubaidofficial/six-figure-jobs/commit/c804808731ff2c2ef65418fe773cd364bb4fb9ba))
* **home:** restore job card snippets + emoji meta ([1f3ada2](https://github.com/Ubaidofficial/six-figure-jobs/commit/1f3ada225728d4c66bc8f562de9f13bb8331d1a0))
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
* Remove unsupported fields from YC scraper ([fb34a95](https://github.com/Ubaidofficial/six-figure-jobs/commit/fb34a9519003bfb4f9d13043e7a8770d8fe0c5c4))
* **routes:** use numeric revalidate literals for Next route handlers ([cbe4cfa](https://github.com/Ubaidofficial/six-figure-jobs/commit/cbe4cfab6e6555372106943399a8a7b83aa73a15))
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
* Show latest jobs by scrape date (createdAt) instead of post date (postedAt) ([2332257](https://github.com/Ubaidofficial/six-figure-jobs/commit/2332257c3b8bbca44a249b5b0dffa4c94e3fe5ea))
* **sitemaps:** emit only canonical v2.8 job URLs ([34241d8](https://github.com/Ubaidofficial/six-figure-jobs/commit/34241d8ca36c90595385329231d90c1d716c1bb1))
* **sitemaps:** force-dynamic to avoid DB access during build ([b425b2f](https://github.com/Ubaidofficial/six-figure-jobs/commit/b425b2fb00c7b1ad35cba8274a0a553e0030072a))
* **snippet:** prevent company-bio text from job card snippet ([51a9188](https://github.com/Ubaidofficial/six-figure-jobs/commit/51a91889f7d842ae9e7722b6f60a2e51db5007da))
* standardize all URLs to www.6figjobs.com for SEO consistency ([7db63cd](https://github.com/Ubaidofficial/six-figure-jobs/commit/7db63cda56c63e7c338382a796f7805a6a34cc9a))
* **trust:** add about/privacy/terms/cookies pages and update footer links ([6b273fb](https://github.com/Ubaidofficial/six-figure-jobs/commit/6b273fb389e2fd91f337378101be610c02089431))
* **v2.9:** align backfill script with Prisma salary quality fields and types ([9bae481](https://github.com/Ubaidofficial/six-figure-jobs/commit/9bae481b7c9ccc25fa18eda7a700256825d4ba35))
* **v2.9:** centralize salary gating + banned-title helper ([829ddd6](https://github.com/Ubaidofficial/six-figure-jobs/commit/829ddd62a9aa65c3cc4395098a672aa3dab7cb24))
* **v2.9:** enforce salaryValidated gating on remote role pages ([76d6f96](https://github.com/Ubaidofficial/six-figure-jobs/commit/76d6f969aee625ed7c551ae3eb86da4d92e1c49c))


### Features

* add WebSite and Organization schemas to homepage ([70607ab](https://github.com/Ubaidofficial/six-figure-jobs/commit/70607ab1148ce47ae54235e8dcd0ce0ef6089851))
* critical SEO fixes + publishing safety (Phase 1) - Add metadataBase, Twitter metadata, keyword optimization, publishing safety gates, real tracking, quality validation, rollback plan, test route noindex - PSEO_ENABLED=false, ultra-conservative rates for new domain - Audit compliance 90% to 98%, Publishing safety 3/8 to 8/8 - TypeScript: 0 errors ([15e4e1f](https://github.com/Ubaidofficial/six-figure-jobs/commit/15e4e1fa83ff71c7258e60a41037b8efc41584d8))
* expand footer to 13 SEO-rich sections with 70+ internal links ([8576a30](https://github.com/Ubaidofficial/six-figure-jobs/commit/8576a307db50153f177e1c79d4b8c79cc99acd85))
* implement shadcn/ui with Six Figure Jobs dark theme ([3cab8f4](https://github.com/Ubaidofficial/six-figure-jobs/commit/3cab8f40adcd941693eb7662a6655e7602970a67))
* **jobs:** permanent canonical redirects + shortId-backed job slugs ([06b72de](https://github.com/Ubaidofficial/six-figure-jobs/commit/06b72de0a560789232890d6640a5a04e8c0522ea))
* major UI/UX improvements - navigation, job cards, AI enrichment, shadows ([40378a1](https://github.com/Ubaidofficial/six-figure-jobs/commit/40378a1b9a249007f9c64056a8e669d6eeec68fc))
* migrate scraper to Railway API (no DB in GitHub Actions) ([b2546ef](https://github.com/Ubaidofficial/six-figure-jobs/commit/b2546ef62c976f20c63771f1530e95aa16cb8d48))
* optimize first paragraphs with primary keywords ($100k, high paying, six figure) ([61f7edb](https://github.com/Ubaidofficial/six-figure-jobs/commit/61f7edb3ada0f41d8e4a5294a08fcdc8f288356b))
* **seo:** canonical role slugs + remove 150k tier ([f9203ef](https://github.com/Ubaidofficial/six-figure-jobs/commit/f9203efc996748fc0fcbe83487920b17e2ec9078))
* **seo:** implement v1.5 rules - 90% compliance ([5c7a9cf](https://github.com/Ubaidofficial/six-figure-jobs/commit/5c7a9cf81baae556738c9b59e2c3b9323741bab2))
* **ui:** upgrade job cards, emojis, and job detail layout ([a37c06f](https://github.com/Ubaidofficial/six-figure-jobs/commit/a37c06f3d9c7e35508569698e7f0356ea4b594b5))




## [Phase 2] - 2025-12-26

### Fixed
- **Expanded canonical roles list from 190 to 620+ roles**
  - Added 100+ Sales & Business Development roles
  - Added 50+ Customer Success & Support roles  
  - Added 60+ Operations & Analytics roles
  - Added 40+ Solutions & Consulting roles
  - Added 50+ Finance & Accounting roles
  - Added 30+ Legal & Compliance roles
  - Added 60+ Marketing roles
  - Added 30+ Developer Relations roles
  - Added 20+ HR & People Operations roles
  - Added 20+ Administrative & Executive Support roles
  - Added executive roles: CEO, President, CISO, etc.

### Database Cleanup (Phase 1)
- Expired 5,942 jobs with missing slugs, thin content, or missing salary
- Expired 995 duplicate jobs (same company/role/location)
- **Result: 863 high-quality jobs remain (100% data completeness)**
  - All jobs have valid role slugs
  - All jobs have city slugs
  - All jobs have descriptions 200+ chars
  - All jobs have validated salary data

### Impact
- Active jobs reduced from 7,800 → 863 (quality over quantity)
- GSC errors expected to drop 95%+ within 48-72 hours
- Sitemap reduced from 5,746 → 840 URLs (all valid)
- Next: Resurrect 2,000-2,500 expired jobs that now map to expanded canonical roles


## [Unreleased] - 2024-12-29

### Fixed
- **Double flag display in job location labels** - Fixed issue where remote jobs showed duplicate country flags (e.g., "🇺🇸 🇺🇸 USA" now correctly displays as "🇺🇸 USA")
  - Added country code to name mapping (US → USA, GB → UK, etc.)
  - Fixed both main and legacy JobCard components
  - Handle descriptive location text properly (e.g., "Remote, USA")
  - Commit: 9c55e4b

- **Remote100k apply URLs** - Fixed apply buttons to point directly to employer ATS instead of aggregator
  - Modified scraper to extract real employer URLs from job detail pages
  - Detects Greenhouse, Lever, Ashby, and other ATS platforms
  - Falls back to aggregator URL if extraction fails
  - Commit: 9f8a6c5

### Technical Improvements
- Enhanced `buildLocationDisplay()` function with better location handling
- Modified `scrapeJobDetailPage()` to return both description and apply URL
- Added comprehensive URL extraction logic for multiple ATS providers

