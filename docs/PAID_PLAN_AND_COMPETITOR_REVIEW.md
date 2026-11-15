# Paid plan, legal gaps, competitor review and SEO teardown

Written 2026-11-15. Nothing here is legal advice. Competitor facts come from public pages read with a summarising fetch
tool on 2026-11-15 (verify in a browser before quoting: prices and features change). Traffic figures are DataForSEO
**estimates** for the US market via OpenSEO, not measured visits. "Unknown" means the source did not say.

## 1. What exists today

- Accounts, Stripe billing, credits and a `/pricing` plan page are built but **off** (`ACCOUNTS_ENABLED` unset). `/pricing`
  redirects to `/jobs`. Launch steps are in `docs/billing-launch-checklist.md`; the credit amounts are placeholders, not decisions.
- Paid for employers today: sponsored placements, `/post-a-job` (noindex), a few slots, rates by email. Jobs are never sold:
  listings come only from the salary-gated pipeline.
- Job alerts exist (`components/alerts`, `docs/job-alerts-launch-checklist.md`).

## 2. Terms and Privacy: gaps to fix before any paid plan

The pages (`app/terms/page.tsx`, `app/privacy/page.tsx`) describe a free directory only.

| Gap | Where | Why it matters |
| --- | --- | --- |
| Nothing about accounts, sign-in, subscriptions, credits, renewal, cancellation, refunds | Terms | Required before charging; the checklist (section 8) already lists this |
| No mention of Google sign-in, Stripe, the email provider, the session cookie, ledger/invoice retention, how to delete an account | Privacy | The code stores a user, sessions and payments once accounts are on |
| "Last updated" is `new Date()`, so it shows **today's date on every visit** | Both | A legal page should show the date the text last changed; as is, the date is meaningless. Fix when the text is next edited |
| Sponsored placements not mentioned | Terms | They are labelled on the page, but the terms are silent |
| EU/UK 14-day digital-content withdrawal and auto-renewal rules | Terms | Depends on where buyers are; ask a lawyer |

I have not changed these pages: the wording is a legal decision (the checklist says a lawyer should review it).

## 3. What the competitors charge and gate (read 2026-11-15)

| Site | Job-seeker paid plan | Gating | Verified |
| --- | --- | --- | --- |
| 4dayweek.io | Pro: $9 weekly, $25 monthly, $49 quarterly (14-day money-back, cancel any time) | Free users see jobs 48 h late, 1 in 5 cards locked, no alerts, no salary floor or date/salary sort; Pro unlocks company name, description and apply link on every job | Read from its `/pro` page |
| remoteok.com | "Remote OK Premium" (100,000+ jobs) | Price not shown | Price unknown |
| remotive.com | "Unlock All Jobs" membership; 24 h early view, alerts, advanced location and salary filters; a "20% off" countdown | Price not shown | Price unknown |
| weworkremotely.com | Not reviewed: the fetch returned HTTP 403 | | Unknown |

## 4. Recommendation for Six Figure Jobs (my proposal, not data)

**Do not copy the "lock jobs and delay them 48 h" model.** Our traffic plan depends on public, indexable job pages and
`JobPosting` JSON-LD, and Google Jobs needs the apply path to be reachable. Hiding company, description or apply link from
visitors would work against both. Sell convenience and speed instead, keep every job page fully public.

Suggested tiers, to be confirmed by the owner:

1. **Free**: everything public today, one saved search with a weekly email.
2. **Pro** (one subscription): instant email alerts for unlimited saved searches, saved jobs and application tracker, hide-seen
   jobs, company watchlist, CSV/export of a search, and the credit-based application kit (already built). Alerts and saved
   searches are the part competitors gate most clearly.
3. **Employers** (separate, no credits): sponsored slot as today, then "featured company page" later.

Open decisions (cannot be made from the code or from the sites):

- Price and billing periods. The only anchor read is 4dayweek's $9/week, $25/month, $49/quarter; I have no data on our
  conversion. Start with one monthly price and one quarterly price, test before adding more.
- Whether credits stay. The code supports a subscription plus two packs; one subscription is simpler to explain.
- Trial or money-back period, refund treatment of used credits, credit expiry (all in the checklist section 8).
- Tax: whether to charge VAT/sales tax and turn on Stripe Tax.

## 5. Filters and page blocks: us vs competitors

Our sidebar filters now: Salary, Work type, Location, Role, Seniority, Remote region, Company size, Technology, Visa.

| Seen on a competitor | Site | In our sidebar? | Note |
| --- | --- | --- | --- |
| Schedule type (4-day week, 9-day fortnight, half-day Friday ...) | 4dayweek | No filter | `/jobs/4-day-week` page and `lib/jobs/fourDayWeek.ts` exist; only 4-day-week is labelled |
| Work-life score, time-off days | 4dayweek | No | Needs data we do not have |
| Posted date (24 h to 90 days) | Remotive | No | Cheapest to add (`postedAt` exists) |
| Employment type, career level, language | Remotive | Seniority yes; type and language no | `employmentTypeLabel` and `languageRequirement` libs exist |
| Benefits tags (401k, async, unlimited vacation ...) | RemoteOK | No | Freehire perks are mapped on the job page; no facet |
| Sort: highest paid, most viewed, hottest | RemoteOK | Recent / salary / relevance | |
| Counted "Related searches", "Jobs by location", "Popular skills", "Top hiring companies" | 4dayweek | Related searches added (below); the others exist as chips | |

## 6. Related searches (built in this change)

A counted card like the screenshot (label left, job count right). Each count uses the **destination page's own query**
(`relatedInput` in `lib/jobs/relatedSearches.ts`), so the number matches what the visitor lands on; links to pages with fewer
than 5 jobs are dropped. Counts are cached 5 minutes.

Done: role pages `/jobs/<role>` (remote variant, top-paying cities, other roles in the field), country pages
`/jobs/location/<country>` (cities and other countries), and the job page right rail (role, country, remote, skills, city).

Not yet done, same card can be added: `/jobs` hub, salary-tier pages, `/remote` and `/remote/<role>` (they have their own
layout without a sidebar), city, category, skill and level pages. These need their own destination queries checked first.
Not built: 4dayweek's work-life, time-off and benefits blocks on the job page (data not in our database).

## 7. SEO teardown (OpenSEO, US estimates; 2 URL sections measured per site)

| | 4dayweek.io | remotive.com |
| --- | --- | --- |
| Organic traffic (est.) | ~34,300 / month | ~23,600 / month |
| Ranking keywords (est.) | ~14,930 | ~7,770 |
| Referring domains | 2,733 (+11% in 12 months) | 5,289 (+20%) |
| Domain rank | 62 (87 until July 2026) | 66 |
| Main engine | `/company/*`: 2,937 keywords, "[company] careers" | `/remote-jobs/*`: 3,500 keywords, "remote [role] jobs" |

Caveats: some volumes swing widely month to month ("writing jobs" 9.9k to 550k), one Remotive figure (position 15 giving
about 2,958 visits) looks inflated, backlink history from the provider is inconsistent, and about 11,000 / 4,200
keywords per site were not attributed to a section.

Moves worth testing (from the data, scaled to our phase-1 indexing policy):

1. Company pages aimed at "[company] careers/jobs" (position 1 to 5, low difficulty): we have company pages; check which are indexable.
2. Role x filter pages with a counted H1 and a four-question FAQ (our role pages already do this).
3. Hubs for higher-pay categories that Remotive ranks for (finance, accounting, HR).
4. A citable data page: 4dayweek's `/countries` draws news links. Ours: `/high-paying-jobs-report` (built).
5. A short verbatim factual summary at the top of company pages (both sites are cited in AI Overviews).

What will not copy: 4dayweek's niche press hook and years of editorial links, Remotive's brand traffic, meme traffic.

Both competitors are now in the OpenSEO project's competitor list (`4dayweek.io`, `remotive.com`; the rest were already
there: remoteok, weworkremotely, remoterocketship, remote100k, remoteyeah, himalayas, wellfound, built in, levels.fyi,
6figr, spainjobs). The findings are in the project's research log.

## 8. Data quality and enrichment (earlier sessions)

See `docs/FREE_ENRICHMENT_PLAN.md`. Relevant to the job page: remote mode, tech stack, years of experience, company
description / founding year / LinkedIn and a one-line AI summary are filled by free, quoted-evidence methods; headcount stays
mostly empty (about 4% fill from free sources). That is why a 4dayweek-style "work-life score" or "time off" card is not
possible yet: the inputs are not in our data.
