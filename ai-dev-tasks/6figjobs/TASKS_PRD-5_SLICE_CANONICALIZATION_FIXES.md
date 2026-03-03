# TASKS — Slice Canonicalization Fixes (P0): Canonical Breadcrumbs + Permanent Redirects

## Rules
- One task = one change
- Must be reversible
- Only touch files in PRD scope (`ai-dev-tasks/6figjobs/PRD-5_SLICE_CANONICALIZATION_FIXES.md`)

---

## Task 1 — Structured data: BreadcrumbList URLs use canonical builder
**Type:** seo  
**Risk:** High  
**Files:** `lib/seo/structuredData.ts`  

### Evidence
- BreadcrumbList built from `slice.slug` segments (legacy shapes): `lib/seo/structuredData.ts:68-89`
- Canonical builder exists and is used for canonical tags: `lib/seo/meta.ts:114-116`, `lib/seo/canonical.ts:28-56`

### Steps
1. Update `buildBreadcrumbJsonLd(slice)` to derive breadcrumb `item` URLs from the canonical slice path (not from `slice.slug`).
2. Keep output valid JSON-LD (`BreadcrumbList` with ordered `ListItem` entries).

### Validation
- `rg -n "slice\\.slug\\.split\\('/'\\)" lib/seo/structuredData.ts` (expected: no match)
- `npm run lint` (expected: succeed)
- `npx tsc --noEmit` (expected: succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation.

---

## Task 2 — Slices: canonicalization redirects are permanent (308)
**Type:** seo  
**Risk:** High  
**Files:** `app/jobs/_components/page.tsx`  

### Evidence
- Canonicalization currently uses temporary `redirect(...)`: `app/jobs/_components/page.tsx:136-139`

### Steps
1. Replace the canonicalization `redirect(...)` with `permanentRedirect(...)` when `requestedPath !== canonicalPath` (preserve `?page=`).
2. Keep salary-band redirect behavior unchanged unless explicitly required.

### Validation
- `rg -n \"permanentRedirect\\(\" app/jobs/_components/page.tsx` (expected: at least one match for canonicalization)
- `npm run lint` (expected: succeed)
- `npx tsc --noEmit` (expected: succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation.

---

## Task 3 — Job pages: BreadcrumbList slice link uses canonical URL shape
**Type:** seo  
**Risk:** Medium  
**Files:** `app/job/[slug]/page.tsx`  

### Evidence
- BreadcrumbList builds legacy slice path (country code + band-last): `app/job/[slug]/page.tsx:1025-1035`

### Steps
1. Replace the legacy slice URL in `buildJobBreadcrumbJsonLd(...)` with a canonical slice path generated from the canonical builder (role + country + 100k band).
2. Ensure the BreadcrumbList item resolves directly to the canonical slice URL (no redirect hop).

### Validation
- `rg -n \"\\/jobs\\/\\$\\{job\\.roleSlug\\}\\/\\$\\{job\\.countryCode\\.toLowerCase\\(\\)\\}\\/100k-plus\" app/job/\\[slug\\]/page.tsx` (expected: no match)
- `npm run lint` (expected: succeed)
- `npx tsc --noEmit` (expected: succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation.

