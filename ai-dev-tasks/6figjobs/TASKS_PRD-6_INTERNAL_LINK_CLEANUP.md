# TASKS — Internal Link Cleanup (P0): Remove “all-roles” Links + Use Canonical Slice URLs

## Rules
- One task = one change
- Must be reversible
- Only touch files in PRD scope (`ai-dev-tasks/6figjobs/PRD-6_INTERNAL_LINK_CLEANUP.md`)

---

## Task 1 — Remove `/all-roles/` internal-link pattern
**Type:** seo  
**Risk:** Medium  
**Files:** `lib/navigation/internalLinks.ts`  

### Evidence
- Emits `/jobs/${bandSlug}/all-roles/${countrySlug}`: `lib/navigation/internalLinks.ts:61-69`

### Steps
1. Remove the “all roles in country” link variant.
2. Replace it with a canonical country-wide slice URL (no fake role segment).

### Validation
- `rg -n \"all-roles\" lib/navigation/internalLinks.ts` (expected: no match)
- `npm run lint` (expected: succeed)
- `npx tsc --noEmit` (expected: succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation.

---

## Task 2 — Homepage: replace legacy slice hrefs with canonical slice URLs
**Type:** seo  
**Risk:** Medium  
**Files:** `app/page.tsx`  

### Evidence
- Legacy/non-canonical links in “Popular Six Figure Job Searches”: `app/page.tsx:632-657`

### Steps
1. Replace hard-coded legacy `href` values with canonical slice URLs (salary-band-first; country slugs).
2. Keep labels/copy unchanged.

### Validation
- `rg -n \"\\/jobs\\/(software-engineer|senior-software-engineer|product-manager|data-engineer)\\/100k-plus\" app/page.tsx` (expected: no match)
- `rg -n \"\\/jobs\\/(us|gb|ca|remote)\\/100k-plus\" app/page.tsx` (expected: no match)
- `npm run lint` (expected: succeed)
- `npx tsc --noEmit` (expected: succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation.

