# Enriching jobs without AI costs

Written 2026-11-14. Numbers marked (prod) come from the read-only `database audit` workflow run against the production
database that day; numbers marked (sample) come from 1,482 real Lever postings fetched from public board APIs; everything
else about third-party free tiers is from web searches and **changes often: verify on the provider's own page before relying on it**.

## Where we are (prod)

- 28,559 live jobs; 21,160 created in the last 7 days.
- AI-enriched: 69 (Greenhouse 67, Ashby 2). Every other source: 0. Job-level AI enrichment is effectively absent.
- Companies (7,937): description, industry, employee count, funding stage, headquarters, founded year, size bucket: **0 filled**.
  Website 2,757, logo 1,134, ATS provider 1,973.
- 5,744 remote jobs; 1,781 without a country; `remoteRegion` is "Global" on all but 16.

## What the free hosted LLM tiers can do

Small, and volatile. OpenRouter's `:free` models: 20 requests/minute; 50 requests/day unless the account has ever bought $10
of credits, then 1,000/day (third-party reports of OpenRouter's docs). That route conflicts with the "never credits" rule.
Cloudflare Workers AI: a free 10,000 Neurons/day pool shared across models (official docs, via search); how many jobs that is
depends on the model. Google AI Studio's free Gemini limits: sources disagree and Google reportedly shows limits only in the
console. So the realistic free LLM budget is **tens to a few hundred jobs a day**, against 28,559 live jobs and thousands of new
ones a week. An AI rewrite cannot be the main path.

## What Remote Rocketship shows (read from a real job page, 2026-11-14)

Per job: location, salary range, employment type, seniority, role category, a "ghost score" with the reasons, where the job
comes from ("posted on the company's careers page, not through a job board"), when it was first seen. Per company: size band,
founded year, industries, a description paragraph, links. Sections: Description, Requirements, Benefits. JSON-LD carries
`experienceRequirements`, `educationRequirements`, `baseSalary`, `directApply`. How they produce the structured parts is not
visible from the page; a search summary says they use an LLM and enrichment APIs, which is unverified.

## The plan: tiers, cheapest first

**Tier 0: free, deterministic, at ingest (done).** Tech stack, remote mode (role-level sentences only), garbled-text repair
(`lib/ingest/enrichAtIngest.ts`). Added with this plan: years of experience (`lib/jobs/experienceRequirement.ts`).
Measured (sample): remote reader precision 94% (15/16) for remote, 94% for hybrid, 100% for on-site, recall only 6-20%, because
most postings never state it; language-requirement flags 60 of 1,482, all 60 genuine on review; experience years found in 58%.
Recall is limited by what postings say, not by the method, and that is fine: it only fills what a posting really states.

**Tier 1: structured data the sources already give.** ATS APIs return departments, offices, workplace type (Lever
`workplaceType`: remote 182, hybrid 664, onsite 578 in the sample), pay ranges. Use these first; they beat any text reading.

**Tier 2: company profiles, once per company, cached.** 7,937 companies, not 28,559 jobs, and a profile changes rarely.
Free sources to test (yield unmeasured except the first): Greenhouse board intro text (21% of boards, 6 of 29 in a sample,
and a board can belong to a different company with the same name: confirm before trusting); the company website's own
`Organization` JSON-LD and meta description (2,757 companies have a website); Wikidata (CC0) for size, founding year and
industry of notable companies. Run as a dry-run workflow first and measure the fill rate before writing anything.

**Tier 3: derived signals, no model.** "Where this job comes from" (employer careers page vs board: we know the source),
"last confirmed open" (we store `lastSeenAt`), a freshness/ghost-style score from posting age, reposts and source.

**Tier 4: LLM only where rules cannot go, budgeted.** A one-line summary for the freshest, best-paid, publishable jobs, cached by
description hash so reposts and duplicates cost nothing, inside the free allowance (`lib/ai/enrichSelection.ts` already ranks
candidates; `lib/ai/freeLlm.ts` already refuses anything that could cost money; enrichment is paused by
`AI_ENRICHMENT_PAUSED`). A small model on a GitHub runner's CPU is another free option; its speed and quality are
unmeasured here and need a benchmark before any decision.

## Next steps, in order

1. Run `evidence audits` (dry run) and review the sentences. 2. Backfill tech stack on existing jobs with
`scripts/backfill-tech-stack.ts`. 3. Prototype Tier 2 as a dry run on the 2,757 companies with a website and measure the fill
rate. 4. Add `experienceRequirements` to JSON-LD only after reviewing accuracy (it is an SEO change). 5. Decide on Tier 4.

## Status, 2026-11-14 evening

- `evidence audits` ran (dry run) against production. Remote reader: of 1,688 live jobs with no `remoteMode`, 31 say the role is
  remote, 599 hybrid, 25 on-site (applied 0). Only 31 would be filled at ingest, so the SEO effect of that reader is small.
  The sample showed two kinds of wrong "hybrid" (a company statement "for most roles", and "a similar hybrid role" as a kind of
  job); both are now ignored. Required languages: German and French dominate, then Mandarin, Italian, Portuguese, Japanese;
  the flags reviewed were genuine except "or another language" lists, now ignored.
- Board seeding applied: 197 boards added (200 requested, 3 failed the live check); 758 verified-new boards remain.
- Homepage profile read, 8 well-known companies (small, biased sample): description 8/8 but as marketing taglines;
  founding year 0/8; size 0/8; LinkedIn link 1/8. Size and founding year probably need another source (Wikidata, for notable
  companies). `company profile measurement` measures this on a random sample of real companies before anything is written.
- `enrichment backfill` (manual, dry run by default) fills tech stack on existing jobs, without overwriting stored skills.

## Tier 4 built (2026-11-14, late)

First real runs of the free dry run: Cloudflare `@cf/meta/llama-3.1-8b-instruct` summarised 3 of 3 jobs in about 10 s and all passed
the check against the posting; OpenRouter's free models managed 1 of 5 in 6 minutes (upstream 429s, empty answers, timeouts).
`ai enrich free` (manual workflow, `scripts/enrich-jobs-free.ts`) uses Cloudflare first and OpenRouter as the fallback, enriches at
most 80 jobs per UTC day, one call per distinct description, saves only answers that pass the check, labels preferred requirements
"Preferred:", and never overwrites an existing summary or the original description. A free-tier job count is an estimate from the
first run's token use (about 5,700 input tokens for 3 jobs) and Cloudflare's published per-token rates as remembered: check
Cloudflare's pricing page, and raise `AI_FREE_DAILY_MAX` only after watching a week of real usage.
