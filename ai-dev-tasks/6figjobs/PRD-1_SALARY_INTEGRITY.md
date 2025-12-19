# PRD — Salary Integrity (P0): Stop Fabricated Salary/Currency in Scrapers

## Type
- Data / Scrapers / SEO

## Motivation
SixFigureJobs’ core promise is “six-figure jobs”, enforced via deterministic salary gates. Several scrapers currently fabricate salary and/or default missing currency, which can allow jobs without real salary evidence to enter the pipeline and undermine the product + SEO positioning.

## Current State (Evidence-Based)
- RemoteOK fabricates “$100k USD” when salary is unknown: `lib/scrapers/remoteok.ts:97-102` (`salaryMin = 100000`, `salaryCurrency = 'USD'`, `salaryInterval = 'year'`).
- RemoteOK defaults currency to USD when currency is missing: `lib/scrapers/remoteok.ts:89` (`salaryCurrency = j.salary_currency || 'USD'`).
- RemoteRocketship fabricates “$100k USD” when salary text is missing: `lib/scrapers/remoterocketship.ts:140-143` (`salaryMin = 100000`, `salaryCurrency = 'USD'`).
- JustJoin defaults currency to USD when currency is missing: `lib/scrapers/justjoin.ts:83` (`const cur = salary.currency || 'USD'`).
- Ingest rejects jobs unless salary is validated: `lib/ingest/index.ts:196-200` (skips when `salaryData.salaryValidated !== true`).
- Repo “truth” forbids currency fallback and requires centralized deterministic salary validation: `docs/DATA_INGEST_SPEC.md:105-109`.
- Salary eligibility is “system law” and must not be overridden by flags: `docs/PROJECT_OS.md:79-90`.

## Problem
Scrapers “invent” salary/currency instead of leaving missing/ambiguous values as `null`. This violates documented ingest rules and risks admitting jobs that do not meet deterministic salary evidence requirements.

## Invariants
- The ingest pipeline must NOT force a currency fallback (no `currency || 'USD'`): `docs/DATA_INGEST_SPEC.md:105-107`.
- Salary validation must be deterministic + centralized (no ad-hoc overrides in scrapers): `docs/DATA_INGEST_SPEC.md:105-109`, `docs/PROJECT_OS.md:79-90`.
- If salary/currency is missing or ambiguous, scrapers should not “force acceptance” by inventing values; ingest should reject.

## Scope
### In
- Remove fabricated salary/currency fallbacks in:
  - `lib/scrapers/remoteok.ts`
  - `lib/scrapers/remoterocketship.ts`
  - `lib/scrapers/justjoin.ts`
- Add a repo-wide invariant check that fails CI if fabricated salary/currency fallbacks reappear:
  - Recommended implementation: extend static checks in `scripts/audit-v2.9.ts:33-53`.
  - CI runs `npm run audit:ci` (`package.json:20`) in `.github/workflows/ci.yml:32-33`.

### Out
- Salary parsing/normalization internals and thresholds (e.g., `lib/currency/thresholds.ts`, `lib/normalizers/salary.ts`).
- UI/SEO copy changes (beyond metadata/eligibility side-effects caused by rejecting bad data).
- Broad scraper refactors or adding new scrapers.

## Proposal (High-Level)
1. **RemoteOK** (`lib/scrapers/remoteok.ts`): remove the “last resort” salary fabrication (`100000` + `USD`) and remove currency defaulting (`|| 'USD'`). If salary/currency is not reliably present, pass `null` and let ingest reject.
2. **RemoteRocketship** (`lib/scrapers/remoterocketship.ts`): remove the “no salaryText → salaryMin=100000 USD” fallback. Leave salary fields `null` when unknown.
3. **JustJoin** (`lib/scrapers/justjoin.ts`): remove currency defaulting to USD. If `salary.currency` is missing/ambiguous, do not construct `salaryText` (so ingest can reject).
4. **Guardrail**: add static CI checks (in `scripts/audit-v2.9.ts`) that fail if:
   - any scraper assigns fabricated salary constants like `100000` to `salaryMin/salaryMax`, and/or
   - any scraper/ingest uses `currency || 'USD'` style fallbacks.

## Risks
- Ingest volume may drop (jobs previously accepted via fabricated salary will now be skipped). This is intended; monitor created/updated/skipped counts.
- Some sources may have low salary coverage; follow-up to improve parsing is possible but out of scope for this PRD.

## Success Criteria
- No fabricated salary/currency fallbacks remain in scrapers.
- CI fails if these patterns are reintroduced.
- `npm run lint`, `npm test`, and `npm run build` pass after implementation.

## Verification
Commands (expected results):
```bash
rg -n "salaryMin\\s*=\\s*100000|salaryMin:\\s*100000|salaryMax\\s*=\\s*100000|salaryMax:\\s*100000" lib/scrapers
# expected: no output

rg -n "currency\\s*\\|\\|\\s*['\\\"]USD['\\\"]|salary_currency\\s*\\|\\|\\s*['\\\"]USD['\\\"]" lib/scrapers lib/ingest
# expected: no output

npm run lint
npm test
npm run build
# expected: all succeed
```

## Rollback
- Revert the PR (or `git revert <commit>`), then rerun the Verification commands.
- Reference: `docs/ROLLBACK-PLAN.md:1-12` (note: rollback restores previous behavior and may reintroduce salary integrity violations; document the tradeoff).

