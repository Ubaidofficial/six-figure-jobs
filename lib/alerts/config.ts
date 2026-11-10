// lib/alerts/config.ts
// Email job alerts: when they are on, and their fixed limits. Everything alert-related is inert unless alertsEnabled():
// the signup forms are not rendered and the routes answer 404.

type Env = Record<string, string | undefined>

const isSet = (v: string | undefined) => typeof v === 'string' && v.trim() !== ''

/**
 * On only when ALERTS_ENABLED=true and everything a lawful email needs is configured: a way to send (RESEND_API_KEY, an
 * HTTPS API that works on every Railway plan; or EMAIL_SERVER, an SMTP URL, which Railway allows only on Pro and up), a
 * From address (EMAIL_FROM) and a postal address for the footer, which the US CAN-SPAM Act requires in every commercial
 * email (ALERTS_POSTAL_ADDRESS).
 */
export function alertsEnabled(env: Env = process.env): boolean {
  if (String(env.ALERTS_ENABLED ?? '').trim().toLowerCase() !== 'true') return false
  return (isSet(env.RESEND_API_KEY) || isSet(env.EMAIL_SERVER)) && isSet(env.EMAIL_FROM) && isSet(env.ALERTS_POSTAL_ADDRESS)
}

/** Pause between two emails in a digest run, under the email API's per-second limit. */
export const SEND_GAP_MS = 600

export type AlertFrequency = 'daily' | 'weekly'
export const ALERT_FREQUENCIES: readonly AlertFrequency[] = ['daily', 'weekly']

/** Jobs in one email; the email links to the rest on the site. */
export const DIGEST_SIZE: Record<AlertFrequency, number> = { daily: 10, weekly: 20 }
/** At most this many jobs from one company per email, so one big hirer cannot fill it. */
export const MAX_JOBS_PER_COMPANY = 2
/**
 * A digest is due when this long has passed since the last one. Slightly under a day / a week, so a daily run that
 * starts a few minutes earlier than yesterday's still sends.
 */
export const DUE_AFTER_MS: Record<AlertFrequency, number> = {
  daily: 20 * 60 * 60 * 1000,
  weekly: (7 * 24 - 4) * 60 * 60 * 1000,
}
/** Never look further back than this for "new" jobs (a first digest, or one after a long gap). */
export const LOOKBACK_MS: Record<AlertFrequency, number> = {
  daily: 2 * 24 * 60 * 60 * 1000,
  weekly: 8 * 24 * 60 * 60 * 1000,
}

/** Searches one address may hold. */
export const MAX_ALERTS_PER_EMAIL = 10
/** Confirmation emails one address may be sent in a day, so the form cannot be used to flood someone's inbox. */
export const MAX_CONFIRMATIONS_PER_EMAIL_PER_DAY = 3
/** Signups from one visitor in 10 minutes. */
export const MAX_SIGNUPS_PER_IP_PER_10_MIN = 5
