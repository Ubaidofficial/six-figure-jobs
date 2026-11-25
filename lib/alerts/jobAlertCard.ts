// lib/alerts/jobAlertCard.ts
// When the job page's alert card appears (owner's choice, 2026-11-25: a floating card with no close button that stays
// until the page is reloaded, and never covers the job text or the Apply button). Pure, so the rules are tested.
//
// It is a card, not an overlay: Google's guidance on intrusive interstitials is about pop-ups that cover the main
// content right after arriving from search, and job pages are where Google Jobs visitors land. The site-wide corner
// popup (lib/alerts/popup.ts) still skips job pages; this card is the job page's own.

/** Shown after this long on the page, or once this share of the page has been scrolled, whichever comes first. */
export const JOB_CARD_DELAY_MS = 8_000
export const JOB_CARD_SCROLL_RATIO = 0.5

/** localStorage key: the time (ms since epoch) until which this visitor counts as signed up (any alert form sets it). */
export const ALERT_SIGNED_UP_KEY = 'sfj-alert-signed-up-until'
export const SIGNED_UP_FOR_MS = 365 * 24 * 60 * 60 * 1000

/** A visitor who already signed up does not see the card. Anything unreadable counts as not signed up. */
export function jobCardHidden(signedUpUntil: string | null, now: number): boolean {
  if (!signedUpUntil) return false
  const until = Number(signedUpUntil)
  return Number.isFinite(until) && until > now
}

/** Whether the card should open now: after the delay, or once the visitor scrolled far enough (pure). */
export function jobCardDue(elapsedMs: number, scrolledRatio: number): boolean {
  return elapsedMs >= JOB_CARD_DELAY_MS || scrolledRatio >= JOB_CARD_SCROLL_RATIO
}

/** The headline: how many matching jobs were posted this week when known, else a plain offer. */
export function jobCardHeadline(newThisWeek: number | null, what: string): string {
  if (newThisWeek && newThisWeek > 1) return `${newThisWeek.toLocaleString('en-US')} new ${what} this week`
  return `New ${what}, straight to your inbox`
}
