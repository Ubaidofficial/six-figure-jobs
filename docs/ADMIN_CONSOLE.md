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
| | System | The same checks; every source with live jobs, added in 24 h and 7 days, and when it last added a job; Google Indexing queue by status with the latest failures; feature switches (on/off only, never values); users and subscriptions; a note on the old scraper. |
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

## Next, not built yet (each needs the owner's go-ahead)

1. **Keep admin visits out of analytics.** GTM and SourceTrack still load on `/ubaid93`, so the owner's own visits count
   as traffic.
2. **Wrong-salary fixes that reach the page.** The page shows `minAnnual`/`maxAnnual` (read at import), so editing pay
   in the console changes only the fallback. A proper fix writes the yearly range and recomputes the salary flags
   (`isHundredKLocal`, `isHighSalary`) through the ingest's own rules.
3. **Reports to action.** Link job reports (wrong salary, fake job, recruiter posting) to the job, with one-click expire
   or edit.
4. **Audit log** of admin actions (who expired or edited what, when). Needs a new table and migration.
5. **Search Console in the console**: indexed share of the current sitemap wave, so raising `SITEMAP_WAVE` is a
   decision made from one screen.
6. **Admin password reset** without the database: a script run from the Openship terminal.
7. **The `M_ID` error.** 180+ reports from `/jobs?q=…`. The name does not appear in this repository; the stack in the
   console should say which script raises it.
