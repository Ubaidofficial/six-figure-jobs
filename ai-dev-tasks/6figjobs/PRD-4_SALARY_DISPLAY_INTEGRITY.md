# PRD — Salary Display Integrity (P0): Remove UI $100k Salary Fallback

## Type
- Fix Existing Feature

## Motivation
SixFigureJobs’ core promise depends on salary trust. The UI currently forces a `$100k` salary floor in job cards when `minAnnual` is missing/invalid, which can mislead users and mask data-quality regressions.

## Current State (Evidence-Based)
- The job list computes annual salary fields that can be `null`:
  - `app/components/JobList.tsx:45-47` (`normalizeAnnualSalary(...)` can return `null`).
- The job list forces a `$100k` fallback when `salaryMin` is nullish:
  - `app/components/JobList.tsx:84-86` (`salaryMin: salaryMin || 100_000`).
- Job cards always render “VERIFIED SALARY” + a salary chip:
  - `components/jobs/JobCardV2.tsx:108-117`.

## Problem
- The UI displays fabricated compensation (`$100k+`) even when the underlying salary evidence is missing, undermining user trust.
- The fallback can hide upstream issues (parsing/normalization returning `null`) by making cards “look” valid.

## Invariants
- Salary eligibility is “system law” and must not be qualified by heuristics/fallbacks: `docs/PROJECT_OS.md:83-91`.
- Missing/ambiguous salary/currency must not be forced into acceptance via defaults: `docs/DATA_INGEST_SPEC.md:105-109`.

## Scope
### In
- `app/components/JobList.tsx`: remove the `salaryMin || 100_000` fallback for display.
- `components/jobs/JobCardV2.tsx`: handle missing salary fields without implying verification.

### Out
- Changes to ingest validation, scraper parsing, or salary thresholds.
- Broad UI redesign.

## Proposal (High-Level)
1. Pass through true `salaryMin/salaryMax` values derived from `minAnnual/maxAnnual` (no fabricated fallback).
2. Update `JobCardV2` to accept `salaryMin: number | null` (and keep `salaryMax: number | null`) and render a neutral “Salary not specified” state when both are missing.
3. Ensure “VERIFIED SALARY” messaging is conditional on having real salary values (and/or a validated flag if available in query results).

## Risks
- More cards may show “Salary not specified” until upstream data issues are addressed; this is preferable to misinformation but could reduce perceived “six-figure” consistency.
- Call sites or types assuming `salaryMin` is always a number may require updates.

## Success Criteria
- No UI code path fabricates salary by defaulting to `100_000`.
- Job cards never display `$100k+` unless backed by real salary fields.
- `npm run lint`, `npm test`, and `npm run build` pass after implementation.

## Verification
Commands (expected results):
```bash
rg -n "salaryMin\\s*:\\s*salaryMin\\s*\\|\\|\\s*100_000" app
# expected: no output
```

Manual:
- Visit a listing page containing at least one job with missing `minAnnual/maxAnnual` and confirm the card does not display `$100k+` or “VERIFIED SALARY”.

## Rollback
- Revert the PR (or `git revert <commit>`), then rerun the Verification steps.
- Reference: `docs/ROLLBACK-PLAN.md:1-12`.

