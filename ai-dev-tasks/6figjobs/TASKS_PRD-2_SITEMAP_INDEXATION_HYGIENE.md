# TASKS — Sitemap + Indexation Hygiene (P0): No Redirects/404s/Noindex in Sitemaps

## Rules
- One task = one change
- Must be reversible
- Only touch files in PRD scope (`ai-dev-tasks/6figjobs/PRD-2_SITEMAP_INDEXATION_HYGIENE.md`)
- Do not commit audit artifacts (`audit_*.txt`, `repo_files.*`) unless explicitly approved (current `git status -sb` shows they are staged)

---

## Task 1 — sitemap-browse: remove redirecting URLs
**Type:** seo  
**Risk:** Medium  
**Files:** `app/sitemap-browse.xml/route.ts`  

### Evidence
- Emits redirecting location URL: `app/sitemap-browse.xml/route.ts:33-38` → redirects via `app/jobs/location/remote/route.ts:4-7`
- Emits redirecting role+remote URL: `app/sitemap-browse.xml/route.ts:61-67` → redirects via `app/jobs/[role]/remote/page.tsx:32-37`

### Steps
1. Stop emitting `/jobs/location/remote` in the sitemap.
2. Stop emitting `/jobs/{role}/remote` in the sitemap.
3. If replacing with canonical URLs, only emit URLs that return 200 and are canonical (e.g., `/remote/{role}` for Tier-1 roles), and avoid adding new URL shapes.

### Validation
- `npm run lint && npm test && npm run build` (expected: all succeed)
- Production spot-check (sample):
  - `curl -I https://www.6figjobs.com/sitemap-browse.xml` (expected: 200)
  - Pick 5-10 `<loc>` entries and `curl -I` each (expected: 200; no 3xx)

### Rollback
- `git revert <commit_sha>` (or revert PR), then repeat Validation spot-check.

---

## Task 2 — Location page: replace soft-404 with true 404
**Type:** seo  
**Risk:** Medium  
**Files:** `app/jobs/location/[country]/page.tsx`  

### Evidence
- Soft-404 render path: `app/jobs/location/[country]/page.tsx:121-126` (“Location not found” returned instead of `notFound()`)
- Metadata for invalid slug is generic: `app/jobs/location/[country]/page.tsx:73-75`

### Steps
1. For invalid `country` slug, call `notFound()` in the page component (true 404).
2. Ensure metadata for invalid slug is consistent with a 404 response (no indexable metadata on “not found”).
3. Keep legacy redirect behavior unchanged for recognized legacy 2-letter country codes: `app/jobs/location/[country]/page.tsx:39-45` and `app/jobs/location/[country]/page.tsx:76-78`.

### Validation
- `npm run lint && npm test && npm run build` (expected: all succeed)
- Production spot-check:
  - `curl -I https://www.6figjobs.com/jobs/location/invalid-country` (expected: 404)

### Rollback
- `git revert <commit_sha>` (or revert PR), then repeat Validation spot-check.

---

## Task 3 — /jobs/[role]: enforce tier robots + canonicalization
**Type:** seo  
**Risk:** High  
**Files:** `app/jobs/[role]/page.tsx`  

### Evidence
- `/remote/[role]` tier robots enforcement: `app/remote/[role]/page.tsx:211-226`
- Tier/canonical role slugs apply to `/jobs/[role]`: `lib/roles/canonicalSlugs.ts:1-4`
- `/jobs/[role]` metadata currently has canonical but no robots/tier gating: `app/jobs/[role]/page.tsx:108-135`

### Steps
1. Mirror `/remote/[role]` behavior for tier handling:
   - Tier-1 roles: indexable (`robots: { index: true, follow: true }`)
   - Tier-2 roles: `noindex,follow`
2. Add canonical slug enforcement using the canonical slug helpers used by `/remote/[role]`: `app/remote/[role]/page.tsx:7-9`.
3. Keep existing `notFound()` behavior for empty results unchanged: `app/jobs/[role]/page.tsx:151`.
4. Avoid redirect loops: only redirect when requested path is non-canonical.

### Validation
- `npm run lint && npm test && npm run build` (expected: all succeed)
- Production spot-check (sample):
  - Canonical mismatch path returns permanent redirect (308) to canonical (expected behavior consistent with `permanentRedirect` usage).
  - Tier-2 role page returns `robots: noindex,follow` (inspect rendered metadata).

### Rollback
- `git revert <commit_sha>` (or revert PR), then repeat Validation spot-check.

---

## Task 4 — Slices: align seeded slugs with canonical builder
**Type:** seo  
**Risk:** High  
**Files:** `scripts/seedJobSlices.ts`, `lib/seo/canonical.ts`  

### Evidence
- Canonical builder uses full country slug via `countryCodeToSlug`: `lib/seo/canonical.ts:50-53` and mapping example `US → united-states`: `lib/seo/countrySlug.ts:24-56`
- Seed script stores 2-letter country code as path segment: `scripts/seedJobSlices.ts:150`

### Steps
1. Align `scripts/seedJobSlices.ts` slug generation to match `buildSliceCanonicalPath(...)` (prefer using `countryCodeToSlug(...)` so persisted `jobSlice.slug` matches canonical).
2. Ensure `resolveSliceCanonicalPath(slice.filters)` resolves to the same URL as `slice.slug` (no mismatch).
3. Plan for updating existing rows (reseeding/upsert) without creating redirects/404s in production.

### Validation
- `npm run lint && npm test && npm run build` (expected: all succeed)
- Run seeding in a controlled environment and verify a sample of updated slices produce matching canonical paths (expected: exact match).

### Rollback
- Revert the seed/canonical changes and (if DB rows were updated) rerun the prior seed logic to restore previous slugs.

---

## Task 5 — Slice sitemaps: ensure emitted URLs are 200 + canonical (decision gate)
**Type:** seo  
**Risk:** High  
**Files:** `app/sitemap-slices/priority/route.ts`, `app/sitemap-slices/longtail/route.ts`, and (if needed) `app/jobs/[...slug]/page.tsx`  

### Evidence
- Slice sitemap emission: `app/sitemap-slices/priority/route.ts:25-69`, `app/sitemap-slices/longtail/route.ts:24-64`
- Slice public route appears missing (`app/jobs/[...slug]` has only `head.tsx`):
  - `ls -la 'app/jobs/[...slug]'` shows only `head.tsx`
  - `find app/jobs -maxdepth 2 -type f -name 'page.tsx'` output does not include `app/jobs/[...slug]/page.tsx`
- Catch-all slice page implementation exists: `app/jobs/_components/page.tsx:26-35` and canonical redirect logic: `app/jobs/_components/page.tsx:131-139`

### Steps
1. **Pre-check:** sample 5-10 URLs from each slice sitemap endpoint and `curl -I` them in production.
2. If any emitted URLs are 404/3xx/non-canonical:
   - Option A (preferred): implement/restore the missing public slice route at `app/jobs/[...slug]/page.tsx` using the existing slice page implementation (currently in `app/jobs/_components/page.tsx`), OR
   - Option B: disable slice sitemaps until routing is correct (do not keep submitting 404s/redirects).
3. Keep sitemap output limited to canonical URLs only.

### Validation
- `npm run lint && npm test && npm run build` (expected: all succeed)
- Production spot-check:
  - `curl -I https://www.6figjobs.com/sitemap-slices/priority` (expected: 200)
  - `curl -I https://www.6figjobs.com/sitemap-slices/longtail` (expected: 200)
  - Sample `<loc>` URLs return 200 and are self-canonical (expected: no 3xx/404)

### Rollback
- Revert the route/sitemap changes, then repeat Validation spot-check.

---

## Task 6 — Company sitemap: exclude noindex companies
**Type:** seo  
**Risk:** Medium  
**Files:** `app/sitemap-company.xml/route.ts`  

### Evidence
- Sitemap includes `jobCount > 0`: `app/sitemap-company.xml/route.ts:13-17`
- Company pages are noindex when `jobCount < 3`: `app/company/[slug]/page.tsx:64-85`

### Steps
1. Change sitemap filter from `jobCount > 0` to `jobCount >= 3` to align sitemap membership with indexability.
2. Keep sitemap max size rules intact (`take: 50000` remains unless evidence requires change).

### Validation
- `npm run lint && npm test && npm run build` (expected: all succeed)
- Production spot-check:
  - `curl -I https://www.6figjobs.com/sitemap-company.xml` (expected: 200)
  - Sample company URLs in sitemap should be indexable (expected: `robots` allows index)

### Rollback
- `git revert <commit_sha>` (or revert PR), then repeat Validation spot-check.

