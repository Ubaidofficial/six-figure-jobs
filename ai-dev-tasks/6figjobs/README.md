# ai-dev-tasks — 6figjobs Index

This folder is the AI operating system for the 6figjobs codebase.
It exists to prevent hallucination, duplication, SEO regressions, and schema/scraper breakage.

Rule: If a file here conflicts with docs/, follow 01_CANONICAL_DOCS_MAP.md.

---

## Required Workflow (Order)

### 0) Truth + Audit First (NO CHANGES)
1) 00_REPO_TRUTH.md
2) 00_AUDIT_FIRST_NO_DUPES.md

### 1) Lock Context (No assumptions)
3) 01_CANONICAL_DOCS_MAP.md
4) 04_RULE_EVOLUTION_PROTOCOL.md

### 2) Define Data Contract (Job eligibility)
5) 02_REQUIRED_JOB_FIELDS.md

### 3) Scraper Governance (growth without spam)
6) 03_SCRAPER_GROWTH_METRICS.md
7) 10_SCRAPERS_AUDIT.md
8) 11_CAREERS_REGISTRY_AND_SEEDS.md
9) 12_SCRAPER_RUN_GROWTH_PROTOCOL.md

### 4) SEO Governance (index safety)
10) 09_SEO_GUARDRAILS.md
11) 13_GSC_INDEXING_TRIAGE.md

### 5) Schema Safety (no breaking changes)
12) 08_SCHEMA_CHANGE_PROTOCOL.md

### 6) Planning + Execution
13) PRD_TEMPLATE.md
14) TASKS_TEMPLATE.md
15) BUG_HUNT_TEMPLATE.md

### 7) Review + Release Discipline
16) 05_CODE_REVIEW_GATE.md
17) 06_RELEASE_AUDIT_UPDATE.md

### 8) Competitive Input (optional, not binding)
18) 07_COMPETITOR_AUDIT_ENRICHMENT.md

---

## Command Packs (Copy/Paste)

- commands/CURSOR_COMMANDS.md
- commands/VSCODE_COMMANDS.md

---

## Operating Rules (Non-Negotiable)

1) Audit before change:
   - Prove feature does not already exist.
   - Cite files and quote code.

2) No hallucination:
   - If unsure, mark UNKNOWN and ask for evidence.

3) No SEO regressions:
   - Canonical, sitemap, redirects, noindex must follow guardrails.

4) No schema drift:
   - Every schema change requires migration + protocol.

5) Scraper growth is measured:
   - Every run should increase careers registry coverage.

