// lib/alerts/popup.ts
// When the job-alert popup may appear. Pure (no browser APIs), so the rules are tested. The popup is a small corner card,
// never a full-screen overlay (Google's intrusive-interstitial guidance), shown after the visitor has been reading for a
// while, and once dismissed it stays away.

/** localStorage key holding the time (ms since epoch) until which the popup stays hidden. */
export const POPUP_STORAGE_KEY = 'sfj-alert-popup-until'
/** sessionStorage key: the popup was already shown in this visit, so it does not return on the next page. */
export const POPUP_SESSION_KEY = 'sfj-alert-popup-shown'

/** Shown after this long on a page, or once this share of the page has been scrolled, whichever comes first. */
export const POPUP_DELAY_MS = 25_000
export const POPUP_SCROLL_RATIO = 0.5

const DAY_MS = 24 * 60 * 60 * 1000
/** Hidden this long after a dismissal. */
export const POPUP_DISMISS_SNOOZE_MS = 14 * DAY_MS
/** Hidden this long after a signup (the visitor already has the alert). */
export const POPUP_SIGNUP_SNOOZE_MS = 365 * DAY_MS

// Pages where it never shows: the job page (the visitor is about to apply; also the phone's sticky Apply bar sits there),
// account and sign-in pages, the alert pages themselves, legal pages, the owner's dashboard and the API.
const BLOCKED_PREFIXES = [
  '/job/',
  '/account',
  '/sign-in',
  '/pricing',
  '/alerts',
  '/ubaid93',
  '/privacy',
  '/terms',
  '/cookies',
  '/post-a-job',
  '/api',
]

export function popupAllowedOnPath(pathname: string): boolean {
  return !BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`))
}

/** True while a stored "hidden until" time is still in the future. Anything unreadable counts as not snoozed. */
export function popupIsSnoozed(stored: string | null, now: number): boolean {
  if (!stored) return false
  const until = Number(stored)
  return Number.isFinite(until) && until > now
}
