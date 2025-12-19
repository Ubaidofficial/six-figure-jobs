# Phase 4 Audit Report — P0 Findings (Canonicals, Internal Links, Salary Display, Category Sitemap)

Date: 2025-12-19

## Scope
Phase 4 audit focused on P0 integrity issues affecting:
- Salary display trust (UI)
- Canonical URL stability (redirects + JSON-LD breadcrumbs)
- Internal-link canonicalization (crawl paths)
- Category sitemap validity + invalid-category 404 semantics

## Findings (Evidence-Based)

### P0-1 — Salary Display Integrity: fabricated `$100k` fallback in UI
- Evidence: `app/components/JobList.tsx:84-86` sets `salaryMin: salaryMin || 100_000`.
- Impact: job cards can display `$100k+` even when `minAnnual` is missing/invalid, masking data quality issues and undermining salary trust.

### P0-2 — Slice Canonicalization: breadcrumbs + redirects not fully canonical
- Evidence: `lib/seo/structuredData.ts:68-89` builds BreadcrumbList URLs from `slice.slug` segments (legacy/non-canonical shapes).
- Evidence: `app/jobs/_components/page.tsx:136-139` uses `redirect(...)` (temporary) for canonicalization.
- Evidence: `app/job/[slug]/page.tsx:1025-1035` builds job breadcrumb slice URL in a legacy shape (`/jobs/{role}/{countryCode}/100k-plus`).
- Impact: inconsistent canonical signals (canonical tag vs JSON-LD), extra redirect hops, and avoidable indexation risk.

### P0-3 — Internal Link Cleanup: “all-roles” pattern + legacy homepage links
- Evidence: `lib/navigation/internalLinks.ts:61-69` emits `/jobs/{band}/all-roles/{country}` links.
- Evidence: `app/page.tsx:632-657` hard-codes legacy slice hrefs (role-first and country-code variants).
- Impact: crawl-path duplication, redirect hops, and low-signal/internal-link noise.

### P0-4 — Sitemap/Category Alignment: sitemap emits invalid category + invalid pages are soft-404
- Evidence: `app/sitemap-category.xml/route.ts:6-13` includes `ai-ml` which does not resolve via the category resolver.
- Evidence: invalid categories render a 200 “Category not found” page: `app/jobs/category/[category]/page.tsx:132-139`.
- Impact: sitemap can include invalid/soft-404 URLs, violating sitemap hygiene guardrails.

## PRDs Created
- `ai-dev-tasks/6figjobs/PRD-4_SALARY_DISPLAY_INTEGRITY.md`
- `ai-dev-tasks/6figjobs/PRD-5_SLICE_CANONICALIZATION_FIXES.md`
- `ai-dev-tasks/6figjobs/PRD-6_INTERNAL_LINK_CLEANUP.md`
- `ai-dev-tasks/6figjobs/PRD-7_SITEMAP_CATEGORY_ALIGNMENT.md`

## TASKS Created
- `ai-dev-tasks/6figjobs/TASKS_PRD-4_SALARY_DISPLAY_INTEGRITY.md`
- `ai-dev-tasks/6figjobs/TASKS_PRD-5_SLICE_CANONICALIZATION_FIXES.md`
- `ai-dev-tasks/6figjobs/TASKS_PRD-6_INTERNAL_LINK_CLEANUP.md`
- `ai-dev-tasks/6figjobs/TASKS_PRD-7_SITEMAP_CATEGORY_ALIGNMENT.md`

## Implementation Summary (Completed)
- PRD-4: removed fabricated salary fallback from job cards and made salary display tolerant of missing salary.
- PRD-5: made slice breadcrumbs canonical, switched slice canonicalization redirects to permanent, and fixed job breadcrumb slice URL to canonical shape.
- PRD-6: removed `/all-roles/` internal links and updated homepage popular links to canonical slice URLs.
- PRD-7: aligned category sitemap slugs with the category resolver and made invalid categories return `notFound()` (true 404 semantics).

## Verification
Per-task validation executed after each task:
- `npm run lint`
- `npx tsc --noEmit`

Final suite (run after docs/changelog updates in this phase):
- `npm run lint && npm test && npm run build`

## Rollback
If regression is detected:
1. Revert the PR (or `git revert <commit_sha>`).
2. Re-run the Verification commands.
3. Reference: `docs/ROLLBACK-PLAN.md`.

