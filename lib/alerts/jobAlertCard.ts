// lib/alerts/jobAlertCard.ts
// When the job page's alert card appears (owner's choice, 2026-11-25: a floating card that never covers the job text or the
// Apply button). Since 2026-11-27 it has a close button (owner's request: "koi close button ya icon nai us pe"): closing it
// keeps it away for JOB_CARD_DISMISS_SNOOZE_MS. On phones it opens only once the visitor has scrolled half way, so it no
// longer lands on the salary box at the top of the page. Pure, so the rules are tested.
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

/** localStorage key: the time (ms since epoch) until which the card stays closed after the visitor closed it. */
export const JOB_CARD_DISMISS_KEY = 'sfj-alert-card-until'
export const JOB_CARD_DISMISS_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

/** True while a stored "until" time (signed up, or closed) is in the future. Anything unreadable counts as not set. */
export function jobCardHidden(until: string | null, now: number): boolean {
  if (!until) return false
  const t = Number(until)
  return Number.isFinite(t) && t > now
}

/**
 * Whether the card should open now (pure). Desktop: after the delay, or once the visitor scrolled far enough. Phones: only
 * once scrolled far enough, since at the top of the page the card would sit on the salary box.
 */
export function jobCardDue(elapsedMs: number, scrolledRatio: number, phone = false): boolean {
  if (scrolledRatio >= JOB_CARD_SCROLL_RATIO) return true
  return !phone && elapsedMs >= JOB_CARD_DELAY_MS
}

/** The headline: how many matching jobs were posted this week when known, else a plain offer. */
export function jobCardHeadline(newThisWeek: number | null, what: string): string {
  if (newThisWeek && newThisWeek > 1) return `${newThisWeek.toLocaleString('en-US')} new ${what} this week`
  return `New ${what}, straight to your inbox`
}
