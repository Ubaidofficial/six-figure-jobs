# Admin console (/ubaid93)

Owner's request (2026-11-24): "improve all the pages for admin console, what features it should have and other pages;
research and plan well; make sure the UI/UX doesn't look AI slop".

## What was wrong (found 2026-11-24, from the code and the owner's screenshots)

| Page | Problem |
|---|---|
| Every page | The public site header, footer, feedback tab and alert popup were drawn above and around the console. |
| Dashboard | "Recent Scrape Runs" showed runs from February marked `running`: the in-app scraper stopped then (no workflow calls `/api/cron/scrape`); jobs come from the GitHub Actions syncs. Nothing showed whether jobs were actually arriving. |
| Error Log | 633 reports listed one by one. Two messages made up nearly all of them, so a new error was hidden. `ResizeObserver loop…` is a browser warning, not a bug. `/api/log-error` stored anything from anyone, without a limit. |
| Jobs | Pagination dropped the search and filters. The list loaded 50 full descriptions per page. The edit preview put scraped HTML straight into the admin page (`dangerouslySetInnerHTML`), so an `<img onerror>` in a posting would run with the admin session. The work-arrangement menu wrote `fully-remote` / `on-site`, which the site does not recognise (it reads `remote`, `hybrid`, `onsite`). Expire did not tell Google or refresh the sitemap. The salary column showed the source fields, not the pay the job page shows. |
| Site Config | Six of its fields (homepage headline, subtitle, badge, banner, footer tagline, meta description) are read nowhere: editing them changed nothing. Only the sponsor slots are used. The API accepted any key, including the freehire change-feed cursor. |
| Feedback | "Reviewed" had no count; the status sent to the API was not checked. |
| Visual | Dark theme unrelated to the site, emoji icons, a separate coloured card per number. |

## What the console is for

One person runs the site. The console should answer, in this order:

1. **Is the site healthy?** Are new jobs arriving, are closed jobs leaving, is Google being told, which sitemap wave is live.
2. **What needs me?** New feedback, new error issues, failed Google notices.
3. **Fix one thing.** Find a job and correct or expire it; place a sponsor.
4. **Is it working for visitors?** Apply clicks, alert signups.

## Pages now

| Group | Page | What it shows |
|---|---|---|
| Monitor | Overview | Live / added / expired / clicks / subscribers; four health checks with a state and age; "Needs a look"; jobs added vs expired per day and apply clicks per day (14 days). |
| | System | The same checks; every source with live jobs, added in 24 h and 7 days, and when it last added a job; Google Indexing queue by status with the latest failures; feature switches (on/off only, never values); users and subscriptions. |
| | Errors | One row per issue (same message, long numbers ignored): reports, last and first seen, pages, browsers, latest stack. Open / All / Browser noise. Resolve or reopen a whole issue. |
| Content | Jobs | Search, source and status filters kept across pages; pay as the job page shows it; title links to the public page; edit drawer loads the job on open, previews the description in a sandboxed iframe, explains which pay fields the page uses. Expire uses the same path as the automatic checks. |
| | Sponsors | The two slots with their live state ("Showing until …", "Not shown: no name", "Ended …"), the link visitors get, save and clear. `/ubaid93/config` redirects here. |
| People | Feedback | Inbox with counts per status; message, page path, screenshot; status actions. |
| | Job alerts | Figures, latest 100 signups, signup pages, CSV export. |
| | Apply clicks | Totals by device and button, clicks per day (30 days), most-clicked jobs and companies. |
| | Auto-apply | Unchanged content, new layout. |

## Design rules used

- The site's own light tokens (`src/styles/design-tokens.css`): off-white page, white panels split by hairlines, Outfit
  headings, JetBrains Mono for figures. One accent (lime) for the current page and the primary button.
- Figures in one hairline-divided panel, not a coloured card each. Status as a small dot plus words.
- lucide icons (already a dependency), no emoji. No gradients, glows or entrance animations.
- Every number has its context in words ("8 min ago", "420 in 14 days").
- Charts are inline SVG bars; no chart library.

## Second pass, built 2026-11-24 (owner's choice: items 5, 1 and 2)

- **Alert emails** (`lib/admin/health.ts`, `lib/admin/healthAlerts.ts`, run from `instrumentation.ts`). Every
  `HEALTH_ALERTS_EVERY_MIN` minutes (default 30, first run 10 minutes after a deploy, 0 = off) the app evaluates the
  health checks and emails `OPS_ALERT_EMAIL` (else `ALERTS_OWNER_EMAIL`) when one turns red, again daily while it stays
  red, and once when it recovers. Red means: fewer than 1,000 live jobs; no new job in 12 h; freehire's change feed not
  read in 24 h; 20 failed Google notices in 24 h; 100 reports of one browser error in an hour. Uses the job-alert
  sender, so it needs `RESEND_API_KEY` (or `EMAIL_SERVER`) and `EMAIL_FROM` in Openship. What was reported is kept in
  SiteConfig `ops.health.alerts`. System page: address (masked), last run, what is open, "Send a test email".
  It cannot tell you the site itself is down (it runs inside it): use an outside uptime monitor on `/api/health`.
- **Job reports you can act on** (`lib/admin/jobReports.ts`). Feedback reads the job id from a report's "Job: … (id)"
  line, shows the job (pay shown, live/expired, open reports on it) with Edit job, Expire and resolve (all its
  reports), Resolve all, Employer page. Filter: Job reports.
- **Review queue** (`/ubaid93/review`, `lib/admin/reviewQueue.ts`). Pay over $600k a year (the import's `needsReview`
  flag, read nowhere before; "Pay is right" clears it, and the import does not set it again once a job has pay) and odd
  titles ("---", a `$` amount or a "150K-200K" range in the title, over 110 characters). Edit / Expire / Employer page.
  Counts in the navigation and on Overview.

## Review pass and charts, 2026-11-24 (owner: "rerun the last pass", "use more bars or line charts")

An independent review of the console's code found, and this pass fixed:

- **An admin Expire did not stick.** The import reactivates expired jobs that their source still lists, so a reported
  scam job came back on the next sync. Jobs expired by hand are now kept in SiteConfig `admin.expired.jobIds`
  (`lib/admin/adminExpired.ts`), and `ingestJob` skips them. Restore removes the mark.
- **Setup was open whenever the account table was empty**, which happens when the site points at an empty database.
  Setup now needs `ADMIN_SETUP_TOKEN` (set in Openship, typed into the form). Sessions name their account and its
  password fingerprint, so a password change ends the old sessions. Old cookies are refused once: sign in again.
  The username is matched in any case.
- **The pay review queue could not be fixed from the console.** The drawer now edits the yearly range the page
  shows, and saving it clears the review flag. The drawer sends only the fields that changed: it used to fill an
  empty currency with USD and reset the posting time. It also accepts "150,000".
- Other fixes:
  - "Noise" is one rule per issue everywhere.
  - The error badge is lighter and cached for a minute.
  - Alert emails say "no longer failing", with the check's current state, and keep a recovery to report if the
    email about it fails.
  - The 24-hour count reads by index.
  - Failed button actions show why.
  - "Live jobs" is renamed "Jobs not expired" (the site lists the subset that passes its quality rules).
  - Overview's "Alert subscribers" counts unique emails, as the Alerts page does.
  - Sponsors says changes reach the site in about 15 minutes.
  - The SQL title rule has word boundaries like the code rule.
  - One "time ago" helper.

Charts (`charts.tsx`: an interactive trend chart; `visuals.tsx`: sparklines, ranked bars, split bars) follow the
data-viz method:
- one axis per chart
- series blue then orange (validated: colour-blind ΔE 24.7)
- 2px lines, columns at most 24px with rounded tops, hairline grid
- a hover readout and a screen-reader table for every chart
- flows (added, expired, clicks, reports, signups) over complete days only, since today's partial count would read
  as a drop

Where they appear:
- **Overview:** sparklines in the figures; jobs not expired over 30 days; added and expired per day; clicks with a
  7-day average; work-arrangement split; top countries.
- **System:** a share bar and a 14-day sparkline per source.
- **Errors:** reports per day, and a sparkline per issue.
- **Apply clicks:** daily columns with the 7-day average; device and button splits; companies as ranked bars.
- **Job alerts:** signups per day; status split; signup pages as ranked bars.

## Next, not built yet (each needs the owner's go-ahead)

1. ~~Keep admin visits out of analytics~~ (done 2026-11-24, PR #231). The owner's visits to public pages still count.
2. ~~Wrong-salary fixes that reach the page~~ (done 2026-11-24: the drawer edits the yearly range, and the API runs it
   through `validateHighSalaryEligibility`, setting `isHighSalary` / `salaryValidated` as the import would;
   `isHundredKLocal` is not used by the import, which always writes false).
3. ~~Reports to action~~ (done 2026-11-24, PR #232).
4. **Audit log** of admin actions (who expired or edited what, when). Needs a new table and migration.
5. **Search Console in the console**: indexed share of the current sitemap wave, so raising `SITEMAP_WAVE` is a
   decision made from one screen.
6. **Admin password reset** without the database: a script run from the Openship terminal.
7. **The `M_ID` error.** 180+ reports from `/jobs?q=…`. The name does not appear in this repository; the stack in the
   console should say which script raises it.
