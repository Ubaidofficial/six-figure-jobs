// Single source of truth for "are accounts and billing switched on?". Plain CommonJS so next.config.js can require it
// (it is evaluated at build time and inlines NEXT_PUBLIC_ACCOUNTS_ENABLED) and TypeScript can import it (allowJs).
//
// Everything account-related is inert unless this returns true: routes answer 404, pages call notFound(), and no
// public page changes. Nothing here touches the database.

/** @typedef {Record<string, string | undefined>} Env */

/** @param {string | undefined} value */
const isSet = (value) => typeof value === 'string' && value.trim() !== ''

/**
 * Accounts are on only when ACCOUNTS_ENABLED=true AND AUTH_SECRET is set. In production AUTH_URL must be set too: it
 * pins the origin Auth.js puts in sign-in links, so a forged Host header can never produce a link to another site.
 * @param {Env} [env]
 */
function accountsEnabled(env = process.env) {
  if (String(env.ACCOUNTS_ENABLED ?? '').trim().toLowerCase() !== 'true') return false
  if (!isSet(env.AUTH_SECRET)) return false
  if (env.NODE_ENV === 'production' && !isSet(env.AUTH_URL)) return false
  return true
}

/** Google sign-in needs both halves of the OAuth client. @param {Env} [env] */
function googleConfigured(env = process.env) {
  return isSet(env.AUTH_GOOGLE_ID) && isSet(env.AUTH_GOOGLE_SECRET)
}

/** Magic-link sign-in needs an SMTP server URL and a From address. @param {Env} [env] */
function emailConfigured(env = process.env) {
  return isSet(env.EMAIL_SERVER) && isSet(env.EMAIL_FROM)
}

/** Billing routes (checkout, portal) additionally need the Stripe secret key. @param {Env} [env] */
function billingEnabled(env = process.env) {
  return accountsEnabled(env) && isSet(env.STRIPE_SECRET_KEY)
}

/** The webhook additionally needs its signing secret; without it the route answers 404. @param {Env} [env] */
function webhookEnabled(env = process.env) {
  return billingEnabled(env) && isSet(env.STRIPE_WEBHOOK_SECRET)
}

/** What a disabled route returns: indistinguishable from a path that does not exist. */
function notFoundResponse() {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

module.exports = {
  accountsEnabled,
  googleConfigured,
  emailConfigured,
  billingEnabled,
  webhookEnabled,
  notFoundResponse,
}
