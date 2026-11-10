# Email job alerts: launch checklist

Everything is in the code but **off**. With it off, no signup form is shown, `/api/alerts*` and `/alerts/*` answer 404,
and the daily workflow sends nothing.

## What it does

1. Every listing page (`/jobs`, role pages, salary pages, country pages, `/remote`) shows "Get new jobs like these by
   email" above the results, for the search on screen. The footer offers the same for all jobs. The visitor picks
   weekly (default) or daily.
2. Only a confirmation email is sent (double opt-in). It links to the alert's own page (`/alerts/<token>`), where a
   button confirms. Mail scanners open links in emails, so confirming, unsubscribing and changing frequency are buttons
   (POST), never plain links.
3. Each day `.github/workflows/job-alerts.yml` (08:43 UTC, after the freehire sync) mails every due alert. The email
   holds the jobs added since its last email that match the saved search, using the same query as the listing page,
   best paid first. It includes at most 2 jobs per company, drops the same job seen on two boards, never repeats a job,
   and holds 10 jobs (daily) or 20 (weekly). An alert with nothing new gets no email.
4. Every digest has `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (Gmail's and Yahoo's
   unsubscribe button), a visible unsubscribe link, why the reader gets it, and the postal address.

Abuse limits:
- 5 signups per visitor per 10 minutes.
- 3 confirmation emails per address per day.
- 10 alerts per address.
- A hidden honeypot field catches form bots.
- The signup answer is the same whether or not the address already has alerts.

The alert's name in emails is built from the checked filters, never taken from the browser. A keyword may not contain a
link or an address.

## Before turning it on

1. **Apply the migration** `20261110180000_add_job_alerts`. It adds two new tables, `JobAlert` and `JobAlertSent`, and
   changes no existing table. Use the "database migrate" workflow with "apply" ticked.
2. **Pick a sending service for bulk email** (an SMTP URL in `EMAIL_SERVER`, e.g.
   `smtps://user:pass@smtp.example.com:465`). A transactional or newsletter provider is better than a personal mailbox.
   On the 6figjobs.com DNS, set **SPF, DKIM and DMARC** for the sending domain; Gmail and Yahoo require them for bulk
   senders. Use an address on that domain in `EMAIL_FROM`, e.g. `Six Figure Jobs <alerts@6figjobs.com>`.
3. **Railway variables** (web app: signup and confirmation emails):
   - `ALERTS_ENABLED=true`
   - `EMAIL_SERVER`
   - `EMAIL_FROM`
   - `ALERTS_POSTAL_ADDRESS`: a real postal address, which the US CAN-SPAM Act requires in every commercial email. A PO
     box or a registered-agent address is fine.
4. **GitHub repository secrets** (daily digest): the same four. `DATABASE_URL` is already there.
5. **Privacy policy**: say that you store the email address, the saved search and which jobs were sent; that it is used
   only for the alert; how to unsubscribe; and how long it is kept.
6. **Try it as yourself** before announcing it:
   - Sign up on a role page, confirm from the email, then run the "job alerts" workflow by hand with "dry run" ticked
     (it builds every email and prints the counts; it sends nothing and records nothing).
   - Then run it with "dry run" unticked and check the email arrives, renders, and that the inbox's own unsubscribe
     button works.

## Preview emails locally

```bash
ALERTS_DRY_RUN_DIR=alert-previews npx tsx scripts/send-job-alerts.ts --dry-run
```

This writes each email as `.html` and `.txt` into `alert-previews/` (git-ignored). Nothing is sent or recorded.

## Known limits

- The per-visitor and per-address limits are kept in memory, so they restart with each deploy.
- Unsubscribed alerts (and their address) are kept so "Subscribe again" works. Delete old ones if your privacy policy
  promises a retention period.
- Not built yet: a single page listing all of one address's alerts; a "jobs like this" box on job pages (the footer form
  covers job pages for now).
