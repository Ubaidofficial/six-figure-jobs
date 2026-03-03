# GSC Best Practices — 6figjobs

## 1) Indexing Rules
- Only submit canonical, indexable `200` URLs in sitemaps (no redirects/noindex/404): `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:11`
- Sitemaps should emit canonical slice paths (not legacy slugs): `app/sitemap-slices/priority/route.ts:55`
- Canonical slice URL shape is salary-band-first (`/jobs/{band}/{remote?}/{role?}/{country?}/{city?}`): `lib/seo/canonical.ts:39`
- Canonical tags for slice/listing pages must use canonical builder output: `lib/seo/meta.ts:114`
- Canonicalization redirects must be permanent (308) to collapse variants: `app/jobs/_components/page.tsx:136`, `app/remote/[role]/page.tsx:192`
- Tier-based robots:
  - Tier-1 roles: `index,follow`; Tier-2 roles: `noindex,follow`: `app/remote/[role]/page.tsx:212`
  - Canonical role slug allowlist is the only valid set: `lib/roles/canonicalSlugs.ts:9`
- Indexability thresholds (avoid thin/low-signal pages):
  - Slices: `totalJobs >= 5` and `page <= 5` to index: `lib/seo/meta.ts:125`
  - Categories: `total >= 3` to index: `app/jobs/category/[category]/page.tsx:113`
  - Company pages: `jobCount >= 3` to index: `app/company/[slug]/page.tsx:65`

## 2) JobPosting Schema Requirements
- Always emit `JobPosting` with core fields: `title`, `description`, `url`, `datePosted`, `validThrough`, `employmentType`, `hiringOrganization`, `identifier`: `lib/seo/jobJsonLd.ts:58`
- Use stable canonical job URLs via slug builder: `lib/jobs/jobSlug.ts:76`
- Remote jobs:
  - Set `jobLocationType: TELECOMMUTE` and do not invent a physical `jobLocation`: `lib/seo/jobJsonLd.ts:46`
  - Only emit `applicantLocationRequirements` when it’s a real geo restriction (block “Global/Worldwide/etc”): `lib/seo/jobJsonLd.ts:149`
- Base salary:
  - Emit `baseSalary` only when `salaryValidated === true` and currency is supported: `lib/seo/jobJsonLd.ts:115`
  - Use `unitText: YEAR` and `minValue/maxValue` when present: `lib/seo/jobJsonLd.ts:137`
- On-site / hybrid jobs:
  - Emit `jobLocation` with `Place` + `PostalAddress` including `addressCountry` (and locality/region when available): `lib/seo/jobJsonLd.ts:207`

## 3) Safe Publishing Strategy
- Use the batch publisher (don’t “bulk publish” ad-hoc): `scripts/publish-pseo-batch.ts:67`
- Kill switch must be on by default; only publish when `PSEO_ENABLED=true`: `scripts/publish-pseo-batch.ts:102`
- Domain-age gate: do not publish on very new domains (`DOMAIN_AGE_WEEKS`): `scripts/publish-pseo-batch.ts:76`
- Budget gates: enforce `maxPagesPerDay` + `maxPagesPerWeek` (and track usage): `scripts/publish-pseo-batch.ts:22`
- Hard cap: ≤50 pages/day (set via `PhaseConfig.maxPagesPerDay`): `scripts/publish-pseo-batch.ts:22`
- Quality gate: minimum jobs/page before publishing (phase-dependent): `scripts/publish-pseo-batch.ts:123`
- Indexing gate: do not increase publishing rate unless GSC coverage ≥80% (indexed/pages): `docs/SEO_SPEC.md:3974`

## 4) 5xx Prevention
- Keep “hot” filters index-backed; add/verify DB indexes for fields used in listing queries: `lib/jobs/queryJobs.ts:109`, `prisma/schema.prisma:86`
- Avoid unbounded DB work:
  - Cap `pageSize` and use pagination (`skip/take`): `lib/jobs/queryJobs.ts:55`
  - Parallelize `count` + `findMany` to reduce tail latency: `lib/jobs/queryJobs.ts:89`
- Use ISR where possible to reduce per-request DB load:
  - Job pages: `app/job/[slug]/page.tsx:24`
  - Slice pages: `app/jobs/_components/page.tsx:19`
  - Homepage: `app/page.tsx:22`
- Cache repeated server lookups where safe (e.g., `cache(...)` around DB fetch): `app/job/[slug]/page.tsx:6`
- Cache sitemap endpoints and cap result sizes: `app/sitemap-slices/priority/route.ts:11`

## 5) Weekly GSC Checklist
- Redirect trend:
  - Monitor “Page with redirect”; spot-check sitemap URLs resolve `200` and self-canonical: `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:13`
  - Confirm canonicalization redirects are 308 (not temporary): `app/jobs/_components/page.tsx:136`
- 5xx:
  - Monitor “Server error (5xx)”; correlate spikes with high-traffic routes and DB load: `lib/jobs/queryJobs.ts:54`
  - Validate DB indexes still cover top filters (role/country/expired/salaryValidated): `prisma/schema.prisma:88`
- 404:
  - Monitor “Not found (404)”; ensure invalid routes are true 404 (not soft-404): `app/jobs/category/[category]/page.tsx:138`
  - Ensure sitemaps don’t emit invalid categories: `app/sitemap-category.xml/route.ts:5`
- Schema validation:
  - Run Rich Results Test for a sample of job pages and confirm `JobPosting` validity: `lib/seo/jobJsonLd.ts:13`
  - Validate remote postings don’t include invalid location objects/strings: `lib/seo/jobJsonLd.ts:46`
- Indexing rate:
  - Track submitted vs indexed; hold publishing rate increases until ≥80% coverage: `docs/SEO_SPEC.md:3974`
  - If coverage drops >10% WoW or manual action appears: stop publishing immediately: `docs/SEO_SPEC.md:3962`

