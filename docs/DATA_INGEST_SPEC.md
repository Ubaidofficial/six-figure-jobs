# 6figjobs — Data Ingest Spec (v1.0)

## 0) Purpose
Define how jobs enter the system, how duplicates are prevented, how salary/location are normalized, and how expiry works.
This prevents “SEO and UX breakage” caused by messy data.

## 1) Ingest Pipeline Overview
Typical stages:
1) Fetch source
2) Parse & extract
3) Normalize (role, location, salary, company)
4) Dedupe / upsert
5) Mark expired / update timestamps
6) Emit logs/metrics

## 2) Uniqueness & Dedupe (Critical)
### 2.1 Unique key strategy
Choose and document the authoritative uniqueness key (example):
- `(sourceBoard, sourceJobId)` OR
- `(companyId, externalUrl)` if stable

Hard requirement:
- Ingest must be idempotent.
- Race conditions must not crash the pipeline.
- Use `upsert` or “create then handle unique constraint gracefully” consistently.

### 2.2 What counts as the same job
Document exact rules:
- same external URL → same job
- same source id → same job
- if URLs change: fallback matching rules (careful, conservative)

## 3) Canonical Role Normalization
Role normalization must use canonical role slug system from SEO_SPEC.
Hard rules:
- No slugify fallback from title.
- If role cannot be mapped to canonical:
  - store role as “unknown/unmapped”
  - do not generate indexable role pages from it
  - still allow the job page to exist if it meets quality requirements

## 4) Salary Normalization
### 4.1 Supported inputs
- ranges (min/max)
- hourly/monthly → convert to annual when possible (document assumptions)
- currencies

### 4.2 Flags
Define when to set:
- `isHighSalary`
- `isHundredKLocal`
- thresholds (e.g., 100_000 annual equivalent)

### 4.3 Display formatting
Salary display must be consistent with UI expectations.

## 5) Location Normalization
Normalize:
- Remote vs Hybrid vs Onsite
- Country code mapping
- Optional city/state (but be careful with index bloat)
Store normalized fields separately from raw fields.

## 6) Expiry Rules
Define:
- When to mark a job expired (age, source says closed, repeated fetch failure)
- How expired jobs are treated:
  - must not appear in indexable listings
  - job page should be noindex or 404/redirect according to SEO_SPEC policy

## 7) Company Normalization
- Company name cleanup rules
- Company dedupe rules
- Logo handling (store URL, validate, cache behavior)
- Slug stability rules for companies

## 8) Logging & Monitoring (Minimum)
Log:
- ingest start/end per source
- created/updated/expired counts
- dedupe events
- failures by stage
Alert on:
- sustained ingest failures
- sudden drop in created/updated counts
- spike in unique constraint collisions

## 9) Data Quality Gates
Before a job is eligible for “money pages”:
- title present
- company present (or placeholder policy)
- application URL present
- role mapped or flagged as unmapped

## 10) “Do Not Ship” Ingest Patterns
- Creating role slugs by slugify(title)
- Writing raw location strings directly into indexable URLs
- Failing the whole run on one job parse failure (must isolate errors)
- Marking everything expired on a single source outage

---

## Reject, Don’t Store (v2.9)

Salary hardening rules:
- The ingest pipeline must NOT force a currency fallback (no `currency || 'USD'`).
- Salary validation MUST be deterministic and centralized in `lib/normalizers/salary.ts` via `validateHighSalaryEligibility(...)`.
- Threshold lookup MUST use the canonical helper `getHighSalaryThresholdAnnual(currency)` from `lib/currency/thresholds.ts` (no other threshold tables).

When to reject/skip ingest:
- Unknown/unsupported currency (`getHighSalaryThresholdAnnual(...) === null`).
- Bad ranges (`min > max`, `max/min > 3`).
- Annualized values above currency-safe caps (caps defined in one place).
- Annualized values below the currency threshold.
- Confidence < 80.
- Title/type indicates junior/entry/intern/graduate/new grad, or part-time/contract/temporary.

Persisted salary quality fields (Job):
- `salaryValidated`, `salaryConfidence`, `salarySource`, `salaryParseReason`, `salaryNormalizedAt`, `salaryRejectedAt`, `salaryRejectedReason`.

Backfill requirement:
- After deploying the v2.9 migration, run `npm run jobs:backfill:salary-quality:v2.9` to mark existing eligible jobs as validated (deterministic; no AI).
