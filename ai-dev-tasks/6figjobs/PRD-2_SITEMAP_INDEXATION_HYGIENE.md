# PRD — Sitemap + Indexation Hygiene (P0): No Redirects/404s/Noindex in Sitemaps

## Type
- Data / Scrapers / SEO

## Motivation
Google indexing stability requires that sitemaps only contain canonical, indexable, 200 URLs. Current sitemap routes include redirect URLs and likely include slice URLs that may 404 or be non-canonical, which violates the repo’s SEO guardrails.

## Current State (Evidence-Based)
- SEO guardrail: sitemaps must not include redirects, noindex pages, or 404 pages: `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:10-23`.

### 1) `sitemap-browse.xml` includes redirect URLs
- Emits `/jobs/location/remote`: `app/sitemap-browse.xml/route.ts:33-38`.
  - That path redirects: `app/jobs/location/remote/route.ts:4-7` (`redirect('/remote/software-engineer')`).
- Emits `/jobs/{role}/remote`: `app/sitemap-browse.xml/route.ts:61-67`.
  - That path redirects: `app/jobs/[role]/remote/page.tsx:32-37` (`permanentRedirect(`/remote/${role}...`)`).

### 2) Soft-404 location page exists (200 “Location not found”)
- For an unknown country slug, metadata returns a generic title instead of 404 semantics: `app/jobs/location/[country]/page.tsx:73-75`.
- For an unknown country slug, the page renders “Location not found” (200) instead of `notFound()`: `app/jobs/location/[country]/page.tsx:121-126`.

### 3) `/jobs/[role]` does not mirror Tier robots enforcement used by `/remote/[role]`
- `/remote/[role]` enforces Tier robots: `app/remote/[role]/page.tsx:211-226` (Tier-2 → `robots: { index: false, follow: true }`).
- `/jobs/[role]` generateMetadata sets canonical but does not set robots/tier gating: `app/jobs/[role]/page.tsx:108-135`.
- Canonical/tier role definitions exist and explicitly apply to `/jobs/[role]`: `lib/roles/canonicalSlugs.ts:1-4`.

### 4) Slice sitemap URLs may be broken/non-canonical (slug mismatch + missing route)
- Slice sitemaps emit URLs using canonical builder: `app/sitemap-slices/priority/route.ts:25-69`, `app/sitemap-slices/longtail/route.ts:24-64`.
- Canonical slice format uses country *slug* from `countryCodeToSlug`: `lib/seo/canonical.ts:31-56` and mapping `US → united-states`: `lib/seo/countrySlug.ts:24-56`.
- Slice seeding uses 2-letter country code in the stored slug: `scripts/seedJobSlices.ts:150` (`.../${countryCode.toLowerCase()}`), which does not match `countryCodeToSlug(...)`.
- Slice route appears missing: `app/jobs/[...slug]` contains only `head.tsx` (directory listing shows no `page.tsx`).
  - Evidence: `ls -la 'app/jobs/[...slug]'` output shows only `head.tsx` (no `page.tsx`).
  - `find app/jobs -maxdepth 2 -type f -name 'page.tsx'` output does not include `app/jobs/[...slug]/page.tsx`.
- A catch-all slice page implementation exists elsewhere and expects `params.slug?: string[]`: `app/jobs/_components/page.tsx:26-35` and performs canonical redirects: `app/jobs/_components/page.tsx:131-139`.

### 5) Company sitemap includes companies that are noindex
- Company sitemap includes `jobCount > 0`: `app/sitemap-company.xml/route.ts:13-17`.
- Company pages set `robots: { index: false }` when `jobCount < 3`: `app/company/[slug]/page.tsx:64-85`.

## Problem
- Sitemaps currently include redirecting URLs, and may include non-canonical or 404 slice URLs.
- Some page types return 200 “not found” pages (soft-404).
- `/jobs/[role]` may over-index tier-2 roles vs the enforced tier rules used by `/remote/[role]`.
- Company sitemap includes URLs that self-declare `noindex`, violating the sitemap guardrail.

## Invariants
- Sitemaps must not include redirects/noindex/404 URLs: `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:13-16`.
- Canonical URL shapes must be stable/deterministic: `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:12`.

## Scope
### In
- Remove/replace redirecting URLs in `app/sitemap-browse.xml/route.ts`.
- Fix soft-404 to true 404 in `app/jobs/location/[country]/page.tsx`.
- Add tier robots enforcement + canonical redirect behavior to `app/jobs/[role]/page.tsx` (mirror `/remote/[role]` approach).
- Align slice canonical builder vs seeded slice slugs:
  - `lib/seo/canonical.ts`
  - `scripts/seedJobSlices.ts`
- Fix company sitemap to match company-page indexability gate:
  - `app/sitemap-company.xml/route.ts`
- Resolve slice sitemap correctness:
  - `app/sitemap-slices/priority/route.ts`
  - `app/sitemap-slices/longtail/route.ts`
  - And (if needed to make slice URLs 200): add/restore the missing slice route at `app/jobs/[...slug]/page.tsx` (currently NOT FOUND) using existing implementation evidence from `app/jobs/_components/page.tsx`.

### Out
- Broad pSEO expansion, new URL patterns, or new sitemap endpoints.
- UI redesign; copy changes except those necessary to enforce 404/tier robots/canonical.
- Non-listed sitemap routes.

## Proposal (High-Level)
1. **`sitemap-browse.xml`**: stop emitting URLs that are known redirects:
   - remove `/jobs/location/remote`
   - remove `/jobs/{role}/remote` (or replace with canonical `/remote/{role}` if confirmed Tier-1 only).
2. **Location page**: replace the “Location not found” render path with `notFound()` and ensure metadata for invalid slugs is non-indexable (true 404 behavior).
3. **Role page tier enforcement**: mirror the `/remote/[role]` tier logic in `/jobs/[role]`:
   - Tier-1 roles: indexable
   - Tier-2 roles: `noindex,follow`
   - Non-canonical slugs: redirect to canonical (avoid loops)
4. **Slices**:
   - Align seed slug format with `buildSliceCanonicalPath(...)` (use `countryCodeToSlug(...)` so stored `jobSlice.slug` matches canonical).
   - Verify that slice sitemap URLs resolve to 200 + self-canonicalize; if slice public route is missing, either:
     - implement the missing public route(s), OR
     - disable slice sitemaps until routing is correct.
   - Do not keep submitting 404s/redirects in slice sitemaps.
5. **Company sitemap**: change filter to `jobCount >= 3` to match company-page robots gate.

## Risks
- High SEO risk: changes affect sitemaps, robots, and canonical behavior. Requires careful spot-checking per `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:18-28`.
- Slice slug alignment may require reseeding/updating existing rows; incorrect changes could create redirect chains or mass 404s.

## Success Criteria
- `sitemap-browse.xml` and slice/company sitemaps contain only canonical 200 URLs (no 3xx/404/noindex).
- Invalid location slugs return true 404 (no soft-404 content).
- `/jobs/[role]` follows tier index rules consistent with `lib/roles/canonicalSlugs.ts:1-4` and `/remote/[role]`.
- `buildSliceCanonicalPath(filters)` matches the persisted `jobSlice.slug` format.

## Verification
Commands (expected results):
```bash
curl -I https://www.6figjobs.com/sitemap-browse.xml
# expected: 200

# pick 5-10 <loc> URLs from each sitemap and confirm:
# - 200 (not 3xx/404)
# - canonical matches the URL

curl -I https://www.6figjobs.com/jobs/location/invalid-country
# expected: 404

npm run lint
npm test
npm run build
# expected: all succeed
```

## Rollback
- Revert the PR (or `git revert <commit>`), then rerun the Verification commands.
- Reference: `docs/ROLLBACK-PLAN.md:1-12` (note: rollback may restore SEO violations; document tradeoff).

