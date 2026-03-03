# Six Figure Jobs — Platform Health Audit
Generated: 2026-01-05T23:48:53.957Z

## Summary Metrics
| metric | value |
| --- | --- |
| Jobs (total) | 13916 |
| Jobs (active) | 11071 |
| Jobs (expired) | 2845 |

## Database Size (Postgres)
| table | total | indexes |
| --- | --- | --- |
| Job | 174 MB | 17 MB |
| Company | 912 kB | 432 kB |
| AiRunLedger | 80 kB | 32 kB |
| Location | 16 kB | 8192 bytes |

## Data Quality (Active Jobs)
| metric | value |
| --- | --- |
| Active jobs | 11071 |
| Null roleSlug | 16 (0.1%) |
| No salary fields (salary*/minAnnual/maxAnnual) | 1935 (17.5%) |
| No normalized salary (minAnnual/maxAnnual) | 4376 (39.5%) |
| Null/empty locationRaw | 0 (0.0%) |
| Thin content (<100 chars descriptionHtml) | 30 (0.3%) |
| Null companyId | 0 (0.0%) |
| Null/empty company text | 0 (0.0%) |
| Null/empty source | 0 (0.0%) |
| Salary validated | 6044 (54.6%) |

## Salary Health
- Outliers (> $2M/yr equivalents): 868

| id | title | company | currency | minAnnual | maxAnnual | salaryMin | salaryMax |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ats:greenhouse:6447954 | Principal Software Engineer - Payroll | Gusto | USD |  |  | 214000 | 500000000 |
| ats:greenhouse:7297082 | Software Engineer Intern (Spring 2026) | Cloudflare | EUR |  |  | 2400 | 50000000 |
| ats:greenhouse:7387441 | Software Engineer, Production SLO | Cloudflare | EUR |  |  | 2400 | 50000000 |
| ats:greenhouse:6960833 | Senior Machine Learning Engineer, Ads | Reddit | AUD |  |  | 100000 | 50000000 |
| ats:greenhouse:7296929 | Software Engineer Intern (Summer 2026) | Cloudflare | EUR |  |  | 2400 | 50000000 |
| ats:greenhouse:7335786 | Senior Software Engineer, Bots + Fraud Detection (EMEA) | Cloudflare | AUD |  |  | 2400 | 50000000 |
| ats:greenhouse:7131934 | Machine Learning Engineer, Ads | Reddit | AUD |  |  | 100000 | 50000000 |
| ats:greenhouse:7206269 | Software Engineer Intern (Summer 2026) - Austin, TX | Cloudflare | EUR |  |  | 2400 | 50000000 |
| ats:greenhouse:8032254002 | Platform Engineer | CircleCI |  |  |  | 3000000 | 50000000 |
| ats:greenhouse:5420308004 | Fullstack Software Engineer - Dataiku Cloud - Onsite or Remote (FR, UK, DE, NL) | Dataiku | AUD |  |  | 1000 | 45000000 |
| ats:greenhouse:7385598 | Third Party Risk Management Senior Analyst, EU | Monzo | EUR |  |  | 1200 | 45000000 |
| ats:greenhouse:7368332 | Commercial Counsel - EU / UK | Marqeta | EUR |  |  | 45000000 | 45000000 |
| ats:greenhouse:5420296004 | Fullstack Software Engineer - Core | Dataiku | AUD |  |  | 1000 | 45000000 |
| ats:greenhouse:5420316004 | Fullstack Software Engineer - Business Solutions - Onsite or Remote (FR, UK, DE, NL) | Dataiku | AUD |  |  | 45000000 | 45000000 |
| ats:greenhouse:6238153 | Staff Machine Learning Scientist | Monzo | AUD |  |  | 1000 | 45000000 |
| ats:greenhouse:5420293004 | Fullstack Software Engineer - Core | Dataiku | AUD |  |  | 1000 | 45000000 |
| ats:greenhouse:7434107 | Data Science Manager, Payments | Monzo | EUR |  |  | 1000 | 45000000 |
| ats:greenhouse:7345862 | Director of Finance | Monzo | AUD |  |  | 1200 | 45000000 |
| ats:greenhouse:6054019 | Lead Machine Learning Scientist | Monzo | EUR |  |  | 1000 | 45000000 |
| ats:greenhouse:5420294004 | Fullstack Software Engineer - Core  | Dataiku | AUD |  |  | 1000 | 45000000 |

### Currency Distribution (Active)
| currency | jobs | validated |
| --- | --- | --- |
| USD | 6418 | 5016 |
| NULL | 2421 | 0 |
| AUD | 1028 | 612 |
| EUR | 837 | 226 |
| CAD | 198 | 94 |
| GBP | 78 | 45 |
| SEK | 40 | 21 |
| SGD | 26 | 25 |
| INR | 22 | 5 |
| CHF | 3 | 0 |

## Freshness (Active Jobs by createdAt)
| bucket | jobs |
| --- | --- |
| 0–7d | 837 |
| 8–30d | 10234 |
| 31–90d | 0 |
| 90d+ | 0 |

## Roles (Active, Top 25)
| roleSlug | jobs |
| --- | --- |
| software-engineer | 1330 |
| senior-software-engineer | 760 |
| account-executive | 612 |
| other | 316 |
| staff-software-engineer | 203 |
| product-manager | 196 |
| engineering-manager | 150 |
| senior-account-executive | 134 |
| senior-product-manager | 126 |
| machine-learning-engineer | 106 |
| field-sales-representative | 72 |
| senior-machine-learning-engineer | 65 |
| product-designer | 58 |
| enterprise-account-executive | 55 |
| senior-data-scientist | 51 |
| backend-engineer | 49 |
| senior-engineering-manager | 46 |
| senior-backend-engineer | 46 |
| data-scientist | 45 |
| full-stack-engineer | 37 |
| data-engineer | 32 |
| sales-development-representative | 32 |
| senior-product-designer | 32 |
| senior-data-engineer | 30 |
| solutions-architect | 26 |

## Company Integrity
- Orphan companies (0 jobs): 1857
- Duplicate company name groups (case-insensitive): 20 shown

| key | dupes |
| --- | --- |
| 1password | 2 |
| best estimate pro | 2 |
| caremessage | 2 |
| circleci | 2 |
| classdojo | 2 |
| code for america | 2 |
| consensys | 2 |
| docusign | 2 |
| github | 2 |
| gitlab | 2 |
| nearform | 2 |
| pagerduty | 2 |
| parcelhero | 2 |
| posthog | 2 |
| revenuecat | 2 |
| securityscorecard | 2 |
| taskrabbit | 2 |
| usertesting | 2 |
| whoop | 2 |
| wp media | 2 |

## Scrapers / Sources (Created in last 7d, Top 25)
| source | created_7d |
| --- | --- |
| ats:ashby | 442 |
| ats:greenhouse | 357 |
| board:weworkremotely | 29 |
| board:remote100k | 14 |
| board:nodesk | 9 |

## ATS Health (Companies with atsProvider)
| atsProvider | companies | success | failed | never_scraped |
| --- | --- | --- | --- | --- |
| greenhouse | 262 | 262 | 0 | 0 |
| ashby | 78 | 78 | 0 | 0 |
| workday | 61 | 61 | 0 | 0 |
| lever | 51 | 51 | 0 | 0 |
| workable | 10 | 10 | 0 | 0 |
| smartrecruiters | 3 | 3 | 0 | 0 |
| bamboohr | 3 | 3 | 0 | 0 |
| breezy | 2 | 2 | 0 | 0 |
| recruitee | 2 | 2 | 0 | 0 |

## AI Enrichment (Active Jobs)
| metric | value |
| --- | --- |
| Active jobs | 11071 |
| AI enriched | 1883 (17.0%) |
| Has aiOneLiner | 1883 (17.0%) |
| Has aiSnippet | 2502 (22.6%) |
| Has aiSummaryJson | 2249 (20.3%) |
| Has techStack | 634 (5.7%) |
| Has skillsJson | 634 (5.7%) |

| metric | value |
| --- | --- |
| Enriched (all time) | 1904 |
| aiSummaryJson has full keys | 741 (38.9%) |
| aiSummaryJson bullets-only | 1163 (61.1%) |
| benefits non-empty | 13 (0.7%) |

### AI Enrichment Rate (last 14d)
| day | enriched |
| --- | --- |
| 2026-01-05 | 239 |
| 2026-01-04 | 291 |
| 2026-01-03 | 365 |
| 2026-01-02 | 29 |
| 2026-01-01 | 55 |
| 2025-12-31 | 68 |
| 2025-12-30 | 304 |
| 2025-12-28 | 263 |
| 2025-12-27 | 176 |

### AI Token Ledger
| window | days | jobs | tokens_in | tokens_out | tokens_per_job |
| --- | --- | --- | --- | --- | --- |
| 7d | 7 | 1199 | 419876 | 184881 | 504 |
| 30d | 9 | 1521 | 488714 | 220633 | 466 |

#### Recent days (top 14)
| day | jobs | tokens_total |
| --- | --- | --- |
| 2026-01-05 | 207 | 120370 |
| 2026-01-04 | 207 | 120238 |
| 2026-01-03 | 200 | 116189 |
| 2026-01-02 | 18 | 10220 |
| 2026-01-01 | 59 | 34464 |
| 2025-12-31 | 139 | 83000 |
| 2025-12-30 | 369 | 120276 |
| 2025-12-27 | 200 | 65256 |
| 2025-12-20 | 122 | 39334 |

