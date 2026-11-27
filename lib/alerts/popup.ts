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

// Pages where it never shows: the job page (the visitor is about to apply; also the phone's sticky Apply bar sits there;
// job pages have their own card, lib/alerts/jobAlertCard.ts),
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

// Exit intent (owner's request, 2026-11-27: "more pop ups through out the site ... collect emails as fast as we can"). A
// centred modal on desktop only, when the mouse leaves through the top edge of the window (towards the tabs or the address
// bar), at most once per visit, on the same pages as the corner popup, and never after a dismissal or a signup (the same
// POPUP_STORAGE_KEY). Google's guidance on intrusive interstitials is about mobile pages that cover content right after a
// visitor arrives from search; this one opens only as a desktop visitor is leaving, never on phones.

// A third alert box inside long job lists, after the 10th row (owner's request, 2026-11-27), besides the ones above and
// below the list (components/listing/ListingParts.tsx). Server HTML, like those: a form, no link or markup that changes SEO.
export const LIST_ALERT_AFTER_ROWS = 10
const LIST_ALERT_MIN_ROWS = 15

/** The index of the row the list's alert box follows, or null when the list is too short for one (pure). */
export function listAlertAfterIndex(rows: number): number | null {
  return rows >= LIST_ALERT_MIN_ROWS ? LIST_ALERT_AFTER_ROWS - 1 : null
}

/** sessionStorage key: the exit-intent modal was already shown in this visit. */
export const EXIT_SESSION_KEY = 'sfj-alert-exit-shown'
/** Not armed during the first seconds on a page, so a mouse passing over the top edge on arrival does not open it. */
export const EXIT_ARM_DELAY_MS = 5_000
/** Only where a mouse is the main pointer and the window is desktop-wide. */
export const EXIT_MEDIA_QUERY = '(min-width: 1024px) and (pointer: fine)'

/** A `mouseout` that leaves the document through its top edge (pure; takes only the two fields it reads). */
export function isExitIntent(e: { clientY: number; relatedTarget: unknown }): boolean {
  return e.relatedTarget == null && e.clientY <= 0
}
