# TASKS — Sitemap/Category Alignment (P0): Valid Category Slugs + 404 for Invalid

## Rules
- One task = one change
- Must be reversible
- Only touch files in PRD scope (`ai-dev-tasks/6figjobs/PRD-7_SITEMAP_CATEGORY_ALIGNMENT.md`)

---

## Task 1 — Category sitemap: align slugs with category resolver
**Type:** seo  
**Risk:** Medium  
**Files:** `app/sitemap-category.xml/route.ts`  

### Evidence
- Hard-coded list includes `ai-ml`: `app/sitemap-category.xml/route.ts:6-13`
- Category resolver keys do not include `ai-ml`: `app/jobs/category/[category]/page.tsx:15-66`

### Steps
1. Update `/sitemap-category.xml` to emit only category slugs that are resolvable by the category page.
2. Keep sitemap output format unchanged (XML urlset).

### Validation
- `npm run lint` (expected: succeed)
- `npx tsc --noEmit` (expected: succeed)
- Manual: open `/sitemap-category.xml` and confirm every `<loc>` maps to a real category page (no “Category not found”).

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation.

---

## Task 2 — Category page: return `notFound()` for invalid categories
**Type:** seo  
**Risk:** Medium  
**Files:** `app/jobs/category/[category]/page.tsx`  

### Evidence
- Invalid category returns 200 content: `app/jobs/category/[category]/page.tsx:132-139`
- Invalid category metadata is generic: `app/jobs/category/[category]/page.tsx:96-99`

### Steps
1. Replace the invalid-category render path with `notFound()` (true 404 semantics).
2. Ensure invalid categories are not indexable (either via 404 or explicit robots metadata).

### Validation
- `npm run lint` (expected: succeed)
- `npx tsc --noEmit` (expected: succeed)
- Manual: request an invalid category (e.g. `/jobs/category/not-a-category`) and confirm a 404.

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation.

