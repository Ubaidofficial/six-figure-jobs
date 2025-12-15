# 6figjobs – Project Operating System

## 1. Product Mission
High-salary job board focused on $100k+ roles with zero index bloat.

---

## 2. Non-Negotiables
- Canonical URLs only (SEO_SPEC owns definitions)
- No index bloat (SEO_SPEC)
- Stable slugs (ARCHITECTURE_SPEC)
- Conversion-first UI (DESIGN_UX_SPEC)
- Data correctness > volume (DATA_INGEST_SPEC)

---

## 3. Authority Map
- SEO decisions → SEO_SPEC.md
- Routing & caching → ARCHITECTURE_SPEC.md
- UI & footer → DESIGN_UX_SPEC.md
- Job ingest & normalization → DATA_INGEST_SPEC.md
- Releases & rollback → RELEASE_QA_SPEC.md

---

## 4. Conflict Resolution
When rules conflict:
1. PROJECT_OS.md
2. SEO_SPEC.md (for indexation, canonicals, sitemaps)
3. Domain owner spec

---

## 5. Change Control
Any change touching:
- URLs or route structure
- sitemaps or sitemap filters
- canonical logic
- footer links or internal link hubs
- ingest normalization or deduplication

→ MUST follow RELEASE_QA_SPEC.md before merge or deploy.

---

## 6. Definition of a “Breaking Change”
A breaking change includes (but is not limited to):
- Introducing a new indexable URL pattern
- Changing canonical slug logic or role mappings
- Allowing Tier-2 or non-canonical pages into sitemaps
- Modifying redirect behavior for role/location pages
- Altering footer structure or internal link strategy
- Changing ingest dedupe keys or expiry behavior
- Causing mass 404s, redirect loops, or noindex leaks

Breaking changes require full QA and rollback readiness.

---

## 7. Infrastructure Reality
- Hosting platform: Railway
- Active branch: `develop` → production
- No staging environment is currently enabled

Because production deploys directly from `develop`,
release discipline and rollback readiness are mandatory.

---

## 8. Versioning
- PROJECT_OS.md: v1.x
- Sub-specs version independently
- Deprecated or historical documents live in `/docs/archive` and are non-authoritative

---

## Salary Hard Gates (v2.9)

Single source of truth:
- Thresholds live in `lib/currency/thresholds.ts`.
- All eligibility checks MUST call `getHighSalaryThresholdAnnual(currency)`.

Global eligibility (system law):
- A job is eligible ONLY IF `salaryValidated === true`, `salaryConfidence >= 80`, currency is supported (`getHighSalaryThresholdAnnual(...) !== null`), and `(maxAnnual >= threshold OR minAnnual >= threshold)`.

Global exclusions (must never show anywhere):
- Titles containing: junior / entry / intern / graduate / new grad.
- Employment type/title indicating: part-time / contract / temporary.

Prohibited qualifiers:
- Flags like `isHighSalary`, `isHundredKLocal`, `isHighSalaryLocal` MUST NOT qualify jobs or override numeric gates.
