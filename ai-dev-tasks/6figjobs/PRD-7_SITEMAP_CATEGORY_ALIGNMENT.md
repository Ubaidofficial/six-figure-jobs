# PRD — Sitemap/Category Alignment (P0): Valid Category Slugs + 404 for Invalid

## Type
- Data / Scrapers / SEO

## Motivation
Sitemaps must only emit canonical, indexable, 200 URLs. The category sitemap currently uses a hard-coded category list that can drift from the category resolver, and invalid category slugs currently return a 200 “Category not found” page. This combination creates soft-404s and violates sitemap/indexation guardrails.

## Current State (Evidence-Based)
- Category sitemap uses a hard-coded list, including a slug that does not resolve:
  - `app/sitemap-category.xml/route.ts:6-13` includes `ai-ml`.
- Category resolver normalizes slugs and looks them up in a fixed map:
  - `app/jobs/category/[category]/page.tsx:68-71` (`slug.toLowerCase().replace(/[^a-z0-9]+/g, '')`).
- The ML/AI category is keyed as `mlai` (not `ai-ml` / `aiml`), creating resolver/sitemap drift:
  - `app/jobs/category/[category]/page.tsx:54-57`.
- Invalid categories do not return 404 semantics:
  - Metadata: `app/jobs/category/[category]/page.tsx:96-99` returns `{ title: 'Jobs | Six Figure Jobs' }` (no `noindex`, no canonical, no 404).
  - Page: `app/jobs/category/[category]/page.tsx:132-139` returns a rendered “Category not found” `<main>` (200).

## Problem
- `/sitemap-category.xml` can include invalid category URLs that resolve to soft-404 content.
- Soft-404 category pages waste crawl budget and risk low-quality indexation.
- Sitemap/category drift is easy to reintroduce without a single source of truth.

## Invariants
- Sitemaps must not include redirects, noindex pages, or 404 pages: `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:11-16`.
- Canonical must be stable and deterministic: `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:8-13`.

## Scope
### In
- `app/sitemap-category.xml/route.ts`: derive category URLs from the same source used to resolve categories (no hard-coded drift).
- `app/jobs/category/[category]/page.tsx`: return `notFound()` for invalid categories (true 404 semantics).

### Out
- Adding new categories or changing category taxonomy.
- Broad redesign of category pages.

## Proposal (High-Level)
1. **Single source of truth**: extract category definitions + resolver into a shared module (e.g., `lib/categories/categories.ts`) that exports:
   - allowed category slugs (canonical list for sitemap)
   - `resolveCategory(...)` helper used by the page
2. **Sitemap alignment**: generate sitemap URLs from the shared canonical category slug list (no drift).
3. **True 404 for invalid**: replace the “Category not found” rendered page with `notFound()` in `CategoryPage`, and ensure metadata path also reflects invalid as non-indexable (ideally by also `notFound()`-ing in `generateMetadata`).
4. **Optional (guardrail)**: exclude categories from the sitemap that are not indexable by the page’s own robots gate (e.g., `total < 3` → `noindex`), to comply with sitemap rules.

## Risks
- Removing invalid/noindex categories from sitemaps may temporarily reduce discovered URLs; this is intended to preserve sitemap integrity.
- Adding DB queries to sitemap generation (if filtering by indexability) must be cached/revalidated to avoid load spikes.

## Success Criteria
- Every `<loc>` in `/sitemap-category.xml` resolves to an indexable, canonical 200 page (no soft-404/noindex).
- Invalid category slugs return a true 404 via `notFound()`.
- `npm run lint`, `npm test`, and `npm run build` pass after implementation.

## Verification
Commands (expected results):
```bash
curl -I "https://www.6figjobs.com/sitemap-category.xml"
# expected: 200

curl -I "https://www.6figjobs.com/jobs/category/ai-ml"
# expected: 404 (if unsupported) OR 308 → canonical slug (if aliasing is introduced)
```

Repo checks:
```bash
rg -n "const categories = \\[" app/sitemap-category\\.xml/route\\.ts
# expected: sitemap should not rely on a divergent hard-coded list
```

## Rollback
- Revert the PR (or `git revert <commit>`), then rerun the Verification steps.
- Reference: `docs/ROLLBACK-PLAN.md:1-12` (note: rollback restores sitemap/category drift and soft-404 behavior).

