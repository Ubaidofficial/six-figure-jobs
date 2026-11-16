# Data roadmap for 2027: history, quality and reports

Written 2026-11-16. Numbers marked (prod) come from read-only workflow runs against the production database that day (database
audit run 43792102398, 30-day research run 43792105256); numbers about other sites and laws come from web pages read or searched
the same day and **change often: check the source before quoting them**. "Not verified" means exactly that.

## 1. Why this exists

A report that says "pay rose" needs last year's pay. Before 2026-11-16 the database kept none: `SalaryAggregate` holds one row per
slice that is overwritten on each recompute, `Job.lastSeenAt` is overwritten by every scrape, and an expired job keeps no record of
when it expired or what it paid before. Whatever is not recorded in 2026 cannot be compared in 2027. The history layer below starts
that record now. Everything in it is append-only and read by no page.

## 2. Where we are (prod, 2026-11-16)

- **29,173 live jobs**; 28,884 with validated pay; 27,658 with an employer posting date. By source: Greenhouse 11,114, freehire
  7,630, Workday 5,456, Ashby 3,557, Lever 882, others under 200 each.
- **Company profiles are almost empty.** Of 8,171 companies: website 2,842, logo 1,134, description 15, founded year 32, LinkedIn 17,
  country 108; headcount, funding stage, headquarters, industry and size band **0**.
- **AI enrichment is 69 jobs** (Greenhouse 67, Ashby 2) of 29,173. The free daily allowance (80 a day by default) cannot change that
  by itself: `docs/FREE_ENRICHMENT_PLAN.md`.
- **Remote jobs: 6,062; 1,288 have no country.**
- **Real expiry dates from sources: about 400 of 29,173.** The page publishes `validThrough` for all of them, derived.
- **Only six-figure listings are kept**: of 22,903 USD jobs with validated pay stored in the last 30 days, 0 paid under $100,000.
  Every pay figure we can publish describes six-figure listings, never pay in general. State that wherever pay is published.
- The 30-day research run (window = jobs we stored in 30 days, which jumps when a source is added; 7,178 jobs were stored on 2026-11-09
  alone) gives a median advertised midpoint of $192,000 over 22,605 jobs at 2,800 employers, and a median of employer medians of
  $182,623; the five largest employers are 21.2% of those jobs. 25.6% of six-figure jobs are flagged for visa sponsorship (the flag's
  precision is not measured) and 21.7% are remote.

## 3. What the history layer records

All of it is written by `.github/workflows/data-history.yml` (daily, with the weekly steps on Mondays), which does nothing until the
migration `20261116040000_add_data_history` has been applied with the `database migrate` workflow.

| Table | What | Script | Cadence |
| --- | --- | --- | --- |
| `JobLifecycle` | per job: first stored, last seen live, expiry first seen, reopen count, each pay change (newest 20) | `scripts/observeJobLifecycle.ts` | daily |
| `ApplyClickWeekly` | apply clicks per completed week by company, role, country, source | `scripts/rollupApplyClicks.ts` | daily (re-rolls the last 4 weeks) |
| `MarketSnapshot` | pay by cell: overall, role, country, role x country, level, arrangement; per currency; the pay method's version stored | `scripts/marketSnapshot.ts` | Mondays |
| `DataScorecard` | fill rates and counts, as JSON, compared with last week's | `scripts/dataScorecard.ts` | Mondays |
| `JobEvidence` | the sentence an enriched field was read from, the reader and its version | written by `scripts/backfillBenefitsEvidence.ts` and `scripts/backfillRemoteEvidence.ts` | with those backfills |

Limits to keep in mind:

- **Lifecycle history starts at the first run.** Jobs already expired by then are not tracked. "Expired observed" is the first run that
  saw it, so a day's resolution at best, and **"days listed" is not time to fill**: a listing coming down does not say whether anyone
  was hired. Remote Rocketship says the same of its own figure ("time to fill is really time to delisting").
- **Cells are in the job's own currency; nothing is converted.** `level` leaves out "mid", which is the column's default for "not
  stated". Cells with under 3 jobs are not stored.
- **A fill rate says a field is present, not that it is right.** Precision needs reviewed examples: `scripts/exportCorrectionLabels.ts`
  turns visitors' job reports into candidates with an empty `verdict` for a person to fill in. A report is a claim, not ground truth.

## 4. How "always improving" is measured

1. The **weekly scorecard** (run summary and `DataScorecard`): each field's share and its change in points since last week. If a
   number does not move, the work did not work.
2. **Quote-backed fields**: new enrichment stores its sentence in `JobEvidence` with the reader's version. Raise the reader's version
   constant (`BENEFITS_EVIDENCE_VERSION`, `REMOTE_EVIDENCE_VERSION`) whenever its rules change.
3. **Corrections as labels**: review the export, keep the reviewed rows as a gold set (a few hundred postings), and measure each
   reader's precision on it before widening what it writes. The plan measured 94% for the remote reader on a sample of 16 postings (15 correct), which is too small to be a bar: the gold set exists to replace it.
4. **Enrich what people see first**: `lib/ai/enrichSelection.ts` now adds a score for apply clicks in the last 30 days and keeps a
   clicked job eligible for as long as the site shows it (14 days by default) instead of 3. The daily budget is unchanged. Clicks are
   the only demand signal in the database; Search Console impressions would be a better one for indexing and are not wired in.

## 5. What others do (read 2026-11-16)

- **Remote Rocketship's ghost-job report** (primary page read): a ghost job is "a public listing with no active hiring behind it";
  intent cannot be observed, so the score uses listing age, reposting, open roles against headcount, the company's slow-close rate and
  salary transparency. 512,744 live listings from 46,517 companies, baselines from 764,260 closed listings. It publishes by company
  and by work arrangement but **not by role or country**: a gap our data can fill. It reports 92% of likely ghosts state no pay against
  52% of others, a reason "every job here states pay" is a trust point, if measured on our own data before it is claimed.
- **Indeed's Wage Tracker** (search summary; the papers were not read): the median posted wage is taken per country, month, job title,
  region and pay type, growth is measured within each cell and the cells are summarised. That design is why `MarketSnapshot` is
  cell-level: it lets a later report measure change within cells, so a shift in the mix of jobs does not read as a pay change.
- **Pay transparency laws** (sources disagree; check each state or national text): there is no US federal posting law; counts of
  states with posting rules range from 13 to 18 depending on the source and date, with more due. The EU Pay Transparency Directive
  (2023/970) had a transposition deadline of 7 June 2026, which most member states reportedly missed, and some summaries say pay must
  be in the advertisement while others say before the first interview. For us: more postings state pay in 2027, unevenly by country,
  so a "share of postings that state pay, by country" series would be new, but it needs the rejected postings counted (below).

## 6. Ideas for 2027, roughly in order

Reports (each a page worth linking to):

1. **Quarterly pay index** by role, country and level, from `MarketSnapshot`, change measured within cells. Needs about a quarter of
   history before the first change figure. Label it "advertised ranges of six-figure listings".
2. **Benefits scorecard** (unlimited PTO, paid parental leave, 401(k), four-day week, learning budget, equity) from the benefits
   reader. Whether `scripts/backfillBenefitsEvidence.ts --apply` has run in production is not verified; it must, with evidence stored.
3. **Days listed and repost patterns** by company and role from `JobLifecycle`, named "days listed" and never "time to fill".
4. **Remote eligibility by country**: who can actually take a remote job (1,288 remote jobs had no country on 2026-11-16).
5. **Skills pay premium** within the same role and level (the 30-day run shows medians by skill, which mix role and seniority).
6. **Pay disclosure by country**: needs the postings the pay gate rejects counted, which the logs show but nothing stores (not verified
   whether any table keeps them). Without that denominator it would describe only what we kept.

Features:

- "Am I paid fairly?" (role, level, country in, percentile out).
- Company comparison pages (pay, benefits, remote policy, days listed).
- "New roles at companies you follow" (fits the Pro plan in `docs/PAID_PLAN_AND_COMPETITOR_REVIEW.md`).
- Salary-range badges: where a posting sits against its cell.
- Data export or API for HR teams: **needs a legal check** on reselling data aggregated from other people's postings.

Enrichment priorities (from section 2): company profiles first (0 of 8,171 have headcount, funding, industry, size or headquarters),
then remote country, then benefits.

## 7. Decisions for the owner

- Whether to keep publishing near-duplicate postings that differ only by language (SerpApi's 12 Developer Advocate pages) once they pass
  the age rule; today they are hidden by it, because their posting dates are old.
- Whether the old scheduled scraper (`daily-scrape.yml`, `disabled_inactivity`) should be re-enabled; the history workflow does not depend on it.
- Whether Search Console impressions should join apply clicks as the demand signal.
- Where to publish the first report, and under which name.

## 8. Sources (read 2026-11-16)

- Remote Rocketship ghost jobs report: https://www.remoterocketship.com/advice/ghost-jobs-report/
- Indeed Wage Tracker: https://github.com/hiring-lab/indeed-wage-tracker
- EU Pay Transparency Directive deadline coverage: https://remoteworkeurope.eu/insights/pay-transparency-transposition-tracker
  and https://www.jacksonlewis.com/index%2Ephp/insights/eu-pay-transparency-uneven-member-state-adoption-four-points-multinational-employers
- US pay transparency by state (vendor guides that disagree on counts): https://www.teamed.global/pay-transparency-laws-by-state
  and https://www.clockspot.com/articles/pay-transparency-laws-by-state
