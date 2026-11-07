# Accounts and billing: launch checklist

Everything for job-seeker accounts and billing is in the code but **off**. With `ACCOUNTS_ENABLED` unset, `/sign-in`, `/account`, `/api/auth/*` and `/api/billing/*` answer 404, `/pricing` still redirects to `/jobs`, and the header is unchanged. The database tables are not touched by any public page, so the code can be deployed before the migration is applied.

This list is everything the owner has to do to turn it on. Do the steps in order. Use Stripe **test mode** end to end first.

## 1. Apply the database migration (first, before anything is enabled)

1. GitHub, Actions, **database migrate**, Run workflow with **apply** unticked. It prints which migrations are pending; `20261106120000_add_accounts_billing` should be the only one.
2. Run it again with **apply** ticked. The migration only creates new tables (`User`, `Account`, `VerificationToken`, `Subscription`, `CreditLedger`, `StripeEvent`) and their indexes and foreign keys. It changes no existing table.
3. Do not set `ACCOUNTS_ENABLED=true` until this has run. With the flag on and no tables, sign-in fails with a server error.

## 2. Stripe

1. Create or open the Stripe account and finish business verification, payout bank account and public business details (these show on Checkout and receipts).
2. **Products and prices** (Product catalogue). Create three prices; the code reads only their ids:
   - a **recurring monthly** price for the subscription -> `STRIPE_PRICE_SUBSCRIPTION`
   - a **one-time** price for the small credit pack -> `STRIPE_PRICE_PACK_SMALL`
   - a **one-time** price for the large credit pack -> `STRIPE_PRICE_PACK_LARGE`

   Amounts and currency live only in Stripe. `/pricing` reads them from Stripe on every request. Every pack and the subscription are quantity 1.
3. **Customer portal** (Settings, Billing, Customer portal): turn it on and allow at least cancelling the subscription, updating the payment method and viewing invoices. Add links to the Terms and Privacy pages. "Manage billing" fails until this is saved in each mode (test and live).
4. **Webhook endpoint** (Developers, Webhooks, Add endpoint):
   - URL: `https://www.6figjobs.com/api/billing/webhook`
   - API version: **2026-10-28.endive**, the version the installed `stripe` package (23.1.0) is written against. Pick it when creating the endpoint. If you leave the account default and it differs, event payloads can have a different shape from what the code reads.
   - Events to send (these seven, no others needed):
     `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`
   - Copy the endpoint's **signing secret** -> `STRIPE_WEBHOOK_SECRET`.
5. Payment methods (Settings, Payment methods): cards and wallets confirm at once. Delayed methods (bank debits) are handled (credits arrive on `checkout.session.async_payment_succeeded`) but have not been tested.
6. Tax: decide whether to charge VAT or sales tax and turn on Stripe Tax if so. The code does not compute tax. Set each price's `tax_behavior` (exclusive or inclusive) **before launch**: a price created as "unspecified" can be set once, and Stripe Tax fails on a price that is left unspecified. Until you have a tax registration, turn on Stripe's free threshold monitoring (Settings, Tax) so you are told before you cross a limit.
6a. Failed payments (Settings, Billing, Revenue recovery): keep **Smart Retries** on and turn on the failed-payment emails and automatic card updates. These are account settings, saved separately in test and live.
7. API key: create a **restricted** key if you prefer (needs write on Customers, Checkout Sessions, Customer portal sessions; read on Prices and Invoice payments), or use the standard secret key -> `STRIPE_SECRET_KEY`. Never put it in the repository or in a `NEXT_PUBLIC_` variable.

## 3. Google sign-in

1. Google Cloud Console, **APIs & Services**, **OAuth consent screen**: app name "Six Figure Jobs", support email, authorised domain `6figjobs.com`, links to the Privacy and Terms pages. Scopes: only `openid`, `email`, `profile`. Set the publishing status to **In production**; in "Testing" only listed test users can sign in.
2. **Credentials**, **Create OAuth client ID**, type **Web application**:
   - Authorised JavaScript origin: `https://www.6figjobs.com`
   - Authorised redirect URI: `https://www.6figjobs.com/api/auth/callback/google` (add `http://localhost:3000/api/auth/callback/google` for local testing)
3. Copy the client id -> `AUTH_GOOGLE_ID` and the client secret -> `AUTH_GOOGLE_SECRET`.

## 4. Email (magic link)

1. Pick any SMTP provider (Postmark, Resend, SES, Mailgun, your own). Create SMTP credentials.
2. `EMAIL_SERVER` is a URL: `smtp://USERNAME:PASSWORD@smtp.example.com:587` (use `smtps://` for port 465). URL-encode special characters in the password.
3. `EMAIL_FROM` is the sender, for example `Six Figure Jobs <login@6figjobs.com>`.
4. On the sending domain set SPF, DKIM and DMARC as the provider instructs, then send yourself a sign-in link to Gmail, Outlook and Apple Mail and check it does not land in spam.
5. Known limit: some corporate mail scanners open links in emails before the person does. A magic link works once, so a scanner can use it up; the person then sees "link expired" and asks for another. Google sign-in avoids this.

## 5. Auth secret and URL

- `AUTH_SECRET`: a long random string, for example `openssl rand -base64 33`. It signs and encrypts session cookies. Changing it signs everyone out.
- `AUTH_URL`: `https://www.6figjobs.com`. Required in production (the flag stays off without it). It pins the address put in sign-in emails and redirects, so a forged `Host` header cannot make a link point somewhere else.

## 6. Environment variables (Railway, service variables)

Set them for the service so they are present at **build time and run time** (Railway does this for service variables). `ACCOUNTS_ENABLED` is read at build to decide whether the header shows a "Sign in" link, and again on every request as the real switch.

| Variable | Required | What it does |
| --- | --- | --- |
| `ACCOUNTS_ENABLED` | to turn on | `true` switches on sign-in, `/account`, billing routes and the `/pricing` plan page. Anything else keeps everything off. |
| `AUTH_SECRET` | yes | Signs and encrypts session cookies (section 5). |
| `AUTH_URL` | yes in production | `https://www.6figjobs.com` (section 5). |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | for Google | OAuth client (section 3). Without both, no Google button. |
| `EMAIL_SERVER`, `EMAIL_FROM` | for magic link | SMTP URL and sender (section 4). Without both, no email form. |
| `AUTH_CLIENT_IP_HOPS` | optional | How many proxies sit in front of the app, default `1`. The sign-in rate limit takes the client address that many entries from the right of `X-Forwarded-For`. Check on Railway that the address it sees is the visitor's, not an internal one. |
| `STRIPE_SECRET_KEY` | for billing | Stripe API key (section 2). Without it billing routes are 404 and `/account` shows no purchase buttons. |
| `STRIPE_WEBHOOK_SECRET` | for billing | Webhook signing secret. Without it the webhook route is 404 and no payment is ever credited. |
| `STRIPE_PRICE_SUBSCRIPTION` | for the subscription | Recurring price id (`price_...`). |
| `STRIPE_PRICE_PACK_SMALL`, `STRIPE_PRICE_PACK_LARGE` | for packs | One-time price ids. A product with no price id is not offered. |
| `BILLING_MONTHLY_CREDITS` | **set it** | Credits granted when a subscription invoice is paid (first payment and each renewal). |
| `BILLING_PACK_SMALL_CREDITS`, `BILLING_PACK_LARGE_CREDITS` | **set them** | Credits per pack purchase. |
| `APPLICATION_KIT_CREDITS` | **set it** | Credits one application kit costs (placeholder 1). Also needs an AI key (`DEEPSEEK_API_KEY` or `OPENAI_API_KEY`) and the `20261106180000_add_application_kit` migration. |

**The three credit amounts have placeholder defaults (100, 50, 250) so development runs. They are not product decisions. Set all three explicitly.** The number a customer is promised at checkout is written into the Checkout Session when it is created, so changing a variable later does not change purchases already in progress.

Also used, already set today: `DATABASE_URL`, and `SITE_URL` / `NEXT_PUBLIC_SITE_URL` (Stripe return URLs use the site URL, `https://www.6figjobs.com`).

## 7. Test in test mode before going live

1. Deploy with test-mode keys and `ACCOUNTS_ENABLED=true`.
2. Sign in with Google, sign out, sign in with an emailed link. Request four links for one address inside 15 minutes: the fourth must be refused.
3. Subscribe with test card `4242 4242 4242 4242`. Within a minute `/account` shows Subscriber and the monthly credits. Buy each pack; the balance rises by the configured amounts.
4. In Stripe, resend a delivered event: the balance must not change (idempotency). Check the webhook's recent deliveries are all `200`.
5. Refund a pack payment in the Stripe dashboard: credits are taken back (up to what is left).
6. Open "Manage billing", cancel the subscription: `/account` shows it ending on the period end date; after it ends the plan reads Free.
7. Only then switch to live keys, live price ids, a live webhook endpoint (its own signing secret) and a live portal configuration.

To turn everything off again: unset `ACCOUNTS_ENABLED` and redeploy. All new routes return to 404 and no data is lost.

## 8. Legal and policy (not done in code, not changed on the site)

The live **Terms**, **Privacy** and **Cookie** pages have not been touched and do not yet mention accounts, payments, credits, subscriptions or refunds. Before launch a lawyer should review and update them, and decide:

- **Refund policy**: what is refundable and when; how a refund treats credits already used. Current behaviour on a refund in Stripe: the credits that payment granted are taken back in proportion to the amount refunded, capped at what the user still has (spent credits are not recovered).
- **Credit expiry**: credits currently never expire and roll over. If they should expire, that needs code.
- **Withdrawal rights** for digital content (EU and UK 14-day rules), and auto-renewal and cancellation rules for subscriptions (US state laws, UK/EU rules): the cancel path is the Stripe portal, linked from `/account`.
- **Disclosures**: Google and Stripe as processors, the email provider, the session cookie (`authjs.session-token`, essential), retention of the ledger and invoices (financial records usually must be kept), and how a user asks for deletion.
- **Tax** collection (section 2.6) and the business name and address shown on receipts.

## 9. What the code does and does not do (decisions to confirm)

- Subscription access: `active` and `trialing`, plus `past_due` for 3 days after it went past due (Stripe is retrying the card; no credits are granted for an unpaid period). `unpaid`, `canceled`, `incomplete` and `paused` have no access. If a "subscription deleted" webhook is ever lost, access stops anyway once the stored period ended more than 3 days ago.
- Monthly credits are granted on `invoice.paid` for the first invoice and each renewal, not for mid-period plan changes or manual invoices. No trial periods are configured. Subscriptions are created in Stripe's flexible billing mode. A dispute (chargeback) takes back the credits that payment granted, in full and capped at the balance; if the dispute is won they are given back.
- One active subscription per user (a second checkout is refused); packs can always be bought.
- **Not built**: disputes and chargebacks (`charge.dispute.*` are not handled, so credits from a disputed charge stay), account deletion (ledger and subscription rows block deleting a user), admin screens for manual credit adjustments, emails about receipts or low balance (Stripe sends receipts if enabled in its settings), and the features that spend credits (`spendCredits` exists and is tested but nothing calls it yet).
- The sign-in email rate limit (3 per address and 10 per IP per 15 minutes) is held in memory per server instance and resets on deploy. It is a brake on abuse, not an audit log.
- Sessions are 14-day JWTs and cannot be revoked server-side; the account page and every billing action re-check that the user still exists, and entitlement is always read from the database, never from the cookie.
