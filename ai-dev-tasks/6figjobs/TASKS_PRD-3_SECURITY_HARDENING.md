# TASKS — Security Hardening (P0): Protect Scrape Endpoints, Remove Leaked Secrets, Block SSRF

## Rules
- One task = one change
- Must be reversible
- Only touch files in PRD scope (`ai-dev-tasks/6figjobs/PRD-3_SECURITY_HARDENING.md`)
- Do not commit audit artifacts (`audit_*.txt`, `repo_files.*`) unless explicitly approved (current `git status -sb` shows they are staged)

---

## Task 1 — Protect `/api/scrape` with Bearer auth
**Type:** fix  
**Risk:** High  
**Files:** `app/api/scrape/route.ts`  

### Evidence
- Unprotected `GET`: `app/api/scrape/route.ts:49-55` (no auth check)
- Existing Bearer auth convention: `app/api/cron/scrape/route.ts:7-11`

### Steps
1. Add an auth guard to `/api/scrape` (reuse the `Authorization: Bearer ${process.env.CRON_SECRET}` pattern).
2. Return 401 on missing/invalid auth.
3. Keep behavior the same for authorized requests.

### Validation
- `npm run lint && npm test && npm run build` (expected: all succeed)
- Production spot-check:
  - `curl -I https://www.6figjobs.com/api/scrape` (expected: 401 without auth)

### Rollback
- `git revert <commit_sha>` (or revert PR), then repeat Validation spot-check.

---

## Task 2 — `/api/cron/ai-enrich`: switch from `?secret=` to Authorization Bearer
**Type:** fix  
**Risk:** High  
**Files:** `app/api/cron/ai-enrich/route.ts`  

### Evidence
- Current query param secret auth: `app/api/cron/ai-enrich/route.ts:8-11`
- Preferred Bearer pattern: `app/api/cron/scrape/route.ts:7-11`

### Steps
1. Replace `req.nextUrl.searchParams.get('secret')` auth with `Authorization: Bearer ...`.
2. Return 401 on missing/invalid auth.
3. Update any cron caller configuration to use Authorization headers (OUTSIDE REPO).

### Validation
- `npm run lint && npm test && npm run build` (expected: all succeed)
- Production spot-check:
  - `curl -I https://www.6figjobs.com/api/cron/ai-enrich` (expected: 401 without auth)

### Rollback
- `git revert <commit_sha>` (or revert PR), then repeat Validation spot-check.

---

## Task 3 — Remove leaked `CRON_SECRET` from `docs/SEO_SPEC.md`
**Type:** fix  
**Risk:** Medium  
**Files:** `docs/SEO_SPEC.md`  

### Evidence
- Literal secret committed: `docs/SEO_SPEC.md:4340`

### Steps
1. Replace the literal value with a placeholder (`CRON_SECRET=<set-in-Railway>`).
2. Ensure no other literal secrets remain.

### Validation
- `rg -n "CRON_SECRET=|6fjbs_cron_" docs/SEO_SPEC.md` (expected: either no match, or only placeholder)
- `npm run lint && npm test && npm run build` (expected: all succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR).
- Rotate `CRON_SECRET` in Railway regardless (rollback does not remove leaked history).

---

## Task 4 — Remove leaked `CRON_SECRET` from `lib/claude-rules-v2.6.md`
**Type:** fix  
**Risk:** Medium  
**Files:** `lib/claude-rules-v2.6.md`  

### Evidence
- Literal secret committed: `lib/claude-rules-v2.6.md:4340`

### Steps
1. Replace the literal value with a placeholder (`CRON_SECRET=<set-in-Railway>`).
2. Ensure no other literal secrets remain.

### Validation
- `rg -n "CRON_SECRET=|6fjbs_cron_" lib/claude-rules-v2.6.md` (expected: either no match, or only placeholder)
- `npm run lint && npm test && npm run build` (expected: all succeed)

### Rollback
- `git revert <commit_sha>` (or revert PR).
- Rotate `CRON_SECRET` in Railway regardless (rollback does not remove leaked history).

---

## Task 5 — Generic scraper SSRF guard: block private/internal URLs
**Type:** fix  
**Risk:** High  
**Files:** `lib/scrapers/generic.ts`  

### Evidence
- DB-sourced URLs: `lib/scrapers/generic.ts:22-28` (`prisma.companySource.findMany(...)`)
- Direct navigation to unvalidated URL: `lib/scrapers/generic.ts:55-56` (`page.goto(source.url, ...)`)

### Steps
1. Add URL validation before calling `page.goto(...)`:
   - allow only `http:`/`https:`
   - block localhost + link-local + private IP ranges (fail closed)
2. On blocked/invalid URL, skip scraping that source and mark error safely.

### Validation
- `npm run lint && npm test && npm run build` (expected: all succeed)
- Manual sanity checks:
  - Attempt to add a `companySource.url` pointing to `http://127.0.0.1` should be blocked (expected: scraper refuses / logs error).

### Rollback
- `git revert <commit_sha>` (or revert PR), then re-run Validation.

---

## Task 6 — Ops: rotate `CRON_SECRET` in Railway (OUTSIDE REPO)
**Type:** data  
**Risk:** High  
**Files:** none (Railway env)  

### Evidence
- `CRON_SECRET` literal is currently committed in repo docs: `docs/SEO_SPEC.md:4340`, `lib/claude-rules-v2.6.md:4340`

### Steps
1. Rotate `CRON_SECRET` in Railway (assume compromise).
2. Update any scheduled jobs/callers to use the new secret (Authorization Bearer header).
3. Confirm old secret no longer works (401).

### Validation
- `curl -I https://www.6figjobs.com/api/cron/scrape` without auth (expected: 401)
- `curl -I https://www.6figjobs.com/api/cron/scrape` with old secret (expected: 401)
- `curl -I https://www.6figjobs.com/api/cron/scrape` with new secret (expected: 200/JSON)

### Rollback
- Rotate secret again (secrets rollback = rotate).

