# Hosted auto-apply: launch checklist (Greenhouse pilot)

Everything for hosted auto-apply is in the code but **off**. It needs accounts on first (see `billing-launch-checklist.md`), then `AUTO_APPLY_ENABLED=true`. Real submission needs a second switch, `AUTO_APPLY_LIVE=true`, and a running worker. Until both are set the worker, if you run it, only fills forms and reports; it sends nothing and charges nothing.

## What it does

1. On `/account/kit/<job>` a signed-in user with a résumé sees **Prepare auto-apply** when the job's apply link is a Greenhouse job (about a third of our links in a 238-job sample; Ashby is 21%, Lever 8%, not supported yet).
2. We read the employer's form from Greenhouse's public Job Board API and write a draft. Free.
3. The user reviews everything on `/account/autoapply/<id>`: their details, the employer's questions, the résumé and cover letter that will be sent. **Only the user's own data is filled in.** Every other question, including work-authorization, clearance, sponsorship and conflict-of-interest questions, is the user's to answer; none is guessed, and the equal-opportunity questions are never answered.
4. The user approves. What they approved is hashed; the worker refuses to send anything that no longer matches (changed answers, changed résumé).
5. The worker fills the employer's form in a real browser and, only in live mode, submits.
6. **A credit price is taken only when the employer's own page confirms the application.** A captcha, a security code, a sign-in wall, a form field we do not recognise, a validation error, or no confirmation after clicking submit all stop the application, charge nothing, and show the user the employer's link to finish themselves. A worker that dies mid-submit is handed back the same way ("unconfirmed") and is never retried automatically, because it may have gone through.

Limits built in: one live application per job, 10 per user per day, 5 per employer board per hour.

## What is verified, and what is not

Verified (tests, and a browser run on a local machine):
- The plan, state machine, approval hash, charging rules, caps, crash recovery and API guards (unit tests with an in-memory database).
- The browser driver, against a **local replica** of the employer form that records what it receives: fills every approved answer, attaches the résumé as a PDF made by the browser, never submits with a required field empty, never guesses an option, and ends each of the stop cases correctly.
- The whole flow on a real Postgres and a real browser: real Greenhouse question schema (read-only) through the review page to approval and cancel; the worker against the replica; both result pages.
- The migration applies cleanly and leaves no drift.

**Not verified, and cannot be without sending a real application:**
- That the driver works on real employer forms. The live form is a React app with searchable dropdowns, a phone-country widget and reCAPTCHA Enterprise. The driver was never run against a real employer's form (that was deliberately not done: it would mean filling real application forms). Expect dropdown, phone or country widgets to need adjustment.
- That the employer's confirmation text is matched correctly (the driver looks for phrases such as "Thank you for applying").
- How often a hosted, headless browser is stopped by reCAPTCHA or an emailed security code. We do not try to get around either, so the success rate may be low from a data-centre address. Measure it before selling it.
- Whether employers' terms allow submissions from a service. Get this reviewed (see Legal below).

## Before turning it on

1. **Legal.** Terms and Privacy must say we submit applications on the user's behalf, which data goes to which employer and to the AI provider, and how long we keep applications. Refund policy for the credit price. A lawyer should read this; it is a service that acts in a user's name on third-party sites.
2. **Apply the migration** `20261106210000_add_auto_apply` (two new tables, `ApplyProfile` and `AutoApplication`; no existing table changes) through the `database migrate` workflow, after the accounts migrations.
3. **Set the price.** `AUTO_APPLY_CREDITS` (placeholder 5) is a product decision. Also set `BILLING_*` credits so a user can afford it.
4. **Dry-run first, on your own application.** Set `AUTO_APPLY_ENABLED=true` (not live). Create an application for a real Greenhouse job as yourself, approve it, and run the worker once:

   ```bash
   npx tsx scripts/autoapply-worker.ts --once
   ```

   Each line says how many fields were filled and which required ones it could not. Fix the driver until your own forms fill cleanly.
5. **Then one live application as yourself**, to a role you really want, with `AUTO_APPLY_LIVE=true`. Check the employer received it and that exactly one price was charged.
6. **Where the worker runs.** It needs puppeteer (a dev dependency here) and a Chromium. Run it as its own process or Railway service with dev dependencies installed; set `AUTOAPPLY_CHROME_PATH` to use an existing Chromium. The web app never imports the driver or puppeteer.

## Never

- Do not add anything that solves captchas, rotates identities or spoofs a browser. The driver deliberately stops and hands back.
- Do not add LinkedIn or Indeed. Only Greenhouse apply links are accepted.
- Do not let the worker answer a question the user did not answer.
