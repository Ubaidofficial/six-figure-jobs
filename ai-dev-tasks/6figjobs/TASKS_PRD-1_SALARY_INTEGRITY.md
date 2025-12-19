# TASKS — Salary Integrity (P0): Stop Fabricated Salary/Currency in Scrapers

## Rules
- One task = one change
- Must be reversible
- Only touch files in PRD scope (`ai-dev-tasks/6figjobs/PRD-1_SALARY_INTEGRITY.md`)
- Do not commit audit artifacts (`audit_*.txt`, `repo_files.*`) unless explicitly approved (current `git status -sb` shows they are staged)

---

## Task 1 — RemoteOK: remove USD/currency fallback + fabricated $100k salary
**Type:** scrapers  
**Risk:** Medium  
**Files:** `lib/scrapers/remoteok.ts`  

### Evidence
- Currency fallback: `lib/scrapers/remoteok.ts:89` (`salaryCurrency = j.salary_currency || 'USD'`)
- Fabricated salary fallback: `lib/scrapers/remoteok.ts:97-102` (`salaryMin = 100000`, `salaryCurrency = 'USD'`, `salaryInterval = 'year'`)

### Steps
1. Remove the `|| 'USD'` currency fallback; keep `salaryCurrency` null when missing.
2. Delete the “last resort” fabricated salary branch; when salary is missing/ambiguous, set salary fields to `null` and rely on ingest rejection.
3. Keep the existing “salary text present” behavior (do not invent salary/currency).

### Validation
- `rg -n "salaryMin\\s*=\\s*100000|salaryMin:\\s*100000|salaryMax\\s*=\\s*100000|salaryMax:\\s*100000" lib/scrapers` (expected: no output)
- `rg -n "currency\\s*\\|\\|\\s*['\\\"]USD['\\\"]|salary_currency\\s*\\|\\|\\s*['\\\"]USD['\\\"]" lib/scrapers lib/ingest` (expected: no output)
- `npm run lint && npm test && npm run build` (expected: all succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation commands.

---

## Task 2 — RemoteRocketship: remove fabricated $100k salary fallback
**Type:** scrapers  
**Risk:** Medium  
**Files:** `lib/scrapers/remoterocketship.ts`  

### Evidence
- Fabricated salary when salary text is missing: `lib/scrapers/remoterocketship.ts:140-143` (`salaryMin = 100000`, `salaryCurrency = 'USD'`)

### Steps
1. Remove the `if (!salaryText) { salaryMin = 100000; salaryCurrency = 'USD' }` fallback.
2. Ensure missing salary remains `null` so ingest deterministically rejects.

### Validation
- `rg -n "salaryMin\\s*=\\s*100000|salaryCurrency\\s*=\\s*'USD'" lib/scrapers/remoterocketship.ts` (expected: no output for that fallback)
- `npm run lint && npm test && npm run build` (expected: all succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation commands.

---

## Task 3 — JustJoin: remove default currency=USD fallback
**Type:** scrapers  
**Risk:** Medium  
**Files:** `lib/scrapers/justjoin.ts`  

### Evidence
- Currency fallback: `lib/scrapers/justjoin.ts:83` (`const cur = salary.currency || 'USD'`)

### Steps
1. Stop defaulting missing `salary.currency` to USD.
2. If currency is missing/ambiguous, do not construct `salaryText` so ingest rejects (do not invent salary/currency).

### Validation
- `rg -n "currency\\s*\\|\\|\\s*['\\\"]USD['\\\"]" lib/scrapers/justjoin.ts` (expected: no output)
- `npm run lint && npm test && npm run build` (expected: all succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation commands.

---

## Task 4 — CI guardrail: fail CI on fabricated salary/currency fallbacks
**Type:** scrapers  
**Risk:** Safe  
**Files:** `scripts/audit-v2.9.ts`  

### Evidence
- Static audit checks pattern exists: `scripts/audit-v2.9.ts:33-53`
- CI runs audit: `package.json:20` and `.github/workflows/ci.yml:32-33`

### Steps
1. Add static grep checks (in the “Static repo checks” section) to fail if:
   - `salaryMin/salaryMax` is set to `100000` in `lib/scrapers`, or
   - any `currency || 'USD'` (or `salary_currency || 'USD'`) fallback exists in `lib/scrapers` or `lib/ingest`.
2. Keep patterns narrowly scoped to avoid false positives (only `lib/scrapers` + `lib/ingest` unless evidence requires expanding).

### Validation
- `rg -n "salaryMin\\s*=\\s*100000|salaryMin:\\s*100000|salaryMax\\s*=\\s*100000|salaryMax:\\s*100000" lib/scrapers` (expected: no output)
- `rg -n "currency\\s*\\|\\|\\s*['\\\"]USD['\\\"]|salary_currency\\s*\\|\\|\\s*['\\\"]USD['\\\"]" lib/scrapers lib/ingest` (expected: no output)
- `npm run lint && npm test && npm run build` (expected: all succeed)
- CI expectation: `.github/workflows/ci.yml` “Audit” step fails if patterns are reintroduced: `.github/workflows/ci.yml:32-33`

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation commands.

