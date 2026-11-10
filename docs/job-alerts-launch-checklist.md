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
2. **Set up Resend (free) to send the emails.** Railway allows outbound SMTP only on its Pro plan
   (https://docs.railway.com/networking/outbound-networking: "SMTP is only available on the Pro plan and above") and
   recommends Resend's HTTPS API, which works on every plan. Resend's free plan was 3,000 emails a month, at most 100 a
   day (check https://resend.com/pricing; these change).
   1. Sign up at resend.com.
   2. Domains → Add domain. Use a sending subdomain such as `mail.6figjobs.com`, so a bad day for bulk mail cannot
      hurt the main domain's mail.
   3. Add the DNS records Resend shows (SPF and DKIM) in Cloudflare, with the proxy off (DNS only). Wait until Resend
      says "Verified".
   4. Add a DMARC record if the domain has none: TXT `_dmarc.6figjobs.com` = `v=DMARC1; p=none; rua=mailto:<your address>`.
      Gmail and Yahoo require DMARC for bulk senders.
   5. API Keys → Create, permission "Sending access", limited to that domain. Copy the key (`re_...`).
   - `EMAIL_FROM`: an address on the verified domain, e.g. `Six Figure Jobs <alerts@mail.6figjobs.com>`.
   - SMTP still works instead (`EMAIL_SERVER`, an SMTP URL) where the host allows it, e.g. the GitHub runner.
     `RESEND_API_KEY` wins when both are set.
3. **Railway variables** (web app: signup and confirmation emails):
   - `ALERTS_ENABLED=true`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `ALERTS_POSTAL_ADDRESS`: a real postal address, which the US CAN-SPAM Act requires in every commercial email. A PO
     box or a registered-agent address is fine.
4. **GitHub repository secrets** (daily digest): the same four. `DATABASE_URL` is already there.

**Capacity on the free plan (100 emails a day).** Every confirmation email and every digest counts. Roughly,
`daily subscribers + weekly subscribers ÷ 7 + new signups` must stay under 100 a day. That is about 100 daily
subscribers or about 600 weekly ones. When a run hits the limit it stops, and the rest go out on the next run,
longest-waiting first. Nothing is lost, but some digests are a day late. Watch `/ubaid93/alerts`, and move to a paid
plan (or a provider with a higher free limit) before you get there.

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
