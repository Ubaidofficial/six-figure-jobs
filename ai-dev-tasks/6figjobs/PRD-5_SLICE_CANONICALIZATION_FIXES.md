# PRD — Slice Canonicalization Fixes (P0): Canonical Breadcrumbs + Permanent Redirects

## Type
- Data / Scrapers / SEO

## Motivation
Canonical stability is a hard SEO requirement. The repo currently generates canonical URLs using a dedicated canonical builder, but produces BreadcrumbList JSON-LD and redirects that can point at legacy/non-canonical slice URL shapes. This creates redirect hops, inconsistent structured data, and avoidable indexation risk.

## Current State (Evidence-Based)
- Canonicals for slice/listing pages are built via the canonical builder:
  - `lib/seo/meta.ts:114-116` (`buildCanonicalUrl(...) → buildSliceCanonicalUrl(...)`).
  - Canonical pattern is defined as salary-band-first: `lib/seo/canonical.ts:28-56`.
- Slice BreadcrumbList JSON-LD is built from `slice.slug` segments (legacy shapes), not the canonical builder:
  - `lib/seo/structuredData.ts:68-89` (`slice.slug.split('/') ... item: SITE_ORIGIN + acc`).
- Slice canonicalization redirects are currently temporary:
  - `app/jobs/_components/page.tsx:136-139` uses `redirect(...)` when `requestedPath !== canonicalPath`.
- Job detail BreadcrumbList JSON-LD links to a legacy slice path using country *code* + band-last ordering:
  - `app/job/[slug]/page.tsx:1025-1035` (`/jobs/${job.roleSlug}/${job.countryCode.toLowerCase()}/100k-plus`).

## Problem
- BreadcrumbList JSON-LD can advertise non-canonical/legacy URLs while `<link rel="canonical">` points elsewhere, weakening canonical signals.
- Slice redirects use `redirect(...)` (temporary) instead of `permanentRedirect(...)`, increasing the chance that non-canonical variants persist in the index.
- Job detail BreadcrumbList JSON-LD points to a non-canonical slice URL shape (country code + band-last), creating extra redirect hops and inconsistent crawl paths.

## Invariants
- Canonical must be stable and deterministic: `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:8-16`.
- Changes impacting canonicals/redirects/structured data are HIGH RISK until proven safe: `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:17-28`.

## Scope
### In
- `lib/seo/structuredData.ts`: build BreadcrumbList item URLs from the canonical builder (not `slice.slug`).
- `app/jobs/_components/page.tsx`: use `permanentRedirect(...)` for canonicalization redirects.
- `app/job/[slug]/page.tsx`: build the slice breadcrumb URL using the canonical builder (correct band order + country slug mapping).

### Out
- Changing the canonical URL strategy itself (the canonical builder remains source of truth).
- Broad refactors of slice routing, metadata, or schema coverage beyond BreadcrumbList URL correctness.

## Proposal (High-Level)
1. **Structured data breadcrumbs**: update `buildBreadcrumbJsonLd(slice)` to derive breadcrumb `item` URLs from `resolveSliceCanonicalPath(slice.filters, slice.slug)` (or `buildSliceCanonicalPath(slice.filters)`), not from `slice.slug.split('/')`.
2. **Permanent slice redirects**: replace `redirect(...)` with `permanentRedirect(...)` in `app/jobs/_components/page.tsx` when `requestedPath` differs from `canonicalPath` (preserve `?page=`).
3. **Job detail breadcrumb slice link**: replace the legacy `/jobs/${role}/${countryCode}/100k-plus` path with a canonical slice path built from `{ minAnnual: 100_000, roleSlugs: [role], countryCode }` using the canonical builder (ensures country slug + band-first ordering).

## Risks
- A wrong canonical redirect made permanent can “lock in” an incorrect URL shape; validation must include multiple slice variants (role/country/remote/city).
- BreadcrumbList changes can affect rich result interpretation; JSON-LD output must remain valid.

## Success Criteria
- Slice BreadcrumbList JSON-LD URLs match the canonical URL shape produced by `buildCanonicalUrl(...)`.
- Non-canonical slice variants 308 to canonical (not temporary redirects).
- Job detail breadcrumb slice link resolves directly (no redirect hop) to the canonical slice URL.
- `npm run lint`, `npm test`, and `npm run build` pass after implementation.

## Verification
Commands (expected results):
```bash
# Ensure breadcrumbs are no longer derived from slice.slug segments
rg -n "slice\\.slug\\.split\\('/'\\)" lib/seo/structuredData.ts
# expected: no output

# Ensure slice canonicalization uses permanentRedirect
rg -n "redirect\\(" app/jobs/_components/page.tsx
# expected: no output (or only non-canonical use cases; canonicalization should be permanentRedirect)
```

HTTP checks (pick a known non-canonical slice URL variant):
```bash
curl -I "https://www.6figjobs.com/jobs/software-engineer/us/100k-plus"
# expected: 308 (permanent) to the canonical slice URL
```

## Rollback
- Revert the PR (or `git revert <commit>`), then rerun the Verification steps.
- Reference: `docs/ROLLBACK-PLAN.md:1-12` (note: rollback may restore canonical inconsistencies).

