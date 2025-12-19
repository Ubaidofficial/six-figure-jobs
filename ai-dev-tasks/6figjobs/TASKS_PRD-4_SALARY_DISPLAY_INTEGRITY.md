# TASKS — Salary Display Integrity (P0): Remove UI $100k Salary Fallback

## Rules
- One task = one change
- Must be reversible
- Only touch files in PRD scope (`ai-dev-tasks/6figjobs/PRD-4_SALARY_DISPLAY_INTEGRITY.md`)

---

## Task 1 — Remove fabricated `$100k` fallback in job cards
**Type:** fix  
**Risk:** Medium  
**Files:** `app/components/JobList.tsx`, `components/jobs/JobCardV2.tsx`  

### Evidence
- UI salary fallback: `app/components/JobList.tsx:84-86` (`salaryMin: salaryMin || 100_000`)
- Salary can be null after normalization: `app/components/JobList.tsx:156-168`
- Job card renders “VERIFIED SALARY” + salary chip unconditionally: `components/jobs/JobCardV2.tsx:108-117`

### Steps
1. Remove the `salaryMin || 100_000` fallback and pass through real `minAnnual/maxAnnual` values (nullable).
2. Update `JobCardV2` types/logic so missing salary displays a neutral state (no fabricated salary; no “VERIFIED SALARY” claim when absent).

### Validation
- `rg -n "salaryMin\\s*:\\s*salaryMin\\s*\\|\\|" app/components/JobList.tsx` (expected: no match)
- `npm run lint` (expected: succeed)
- `npx tsc --noEmit` (expected: succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation.

