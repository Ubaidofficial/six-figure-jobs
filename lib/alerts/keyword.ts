// lib/alerts/keyword.ts
// What an alert's free-text keyword may be. Shared by the signup form (browser) and the server's filter check, so the
// form can say so instead of the server dropping a keyword it refuses and signing the visitor up for every job.

const KEYWORD = /^[\p{L}\p{N}][\p{L}\p{N} +#.&/-]{0,59}$/u

/** A link or an address has no place in a job search, and would turn the confirmation email into a carrier for one. */
export const looksLikeLink = (s: string) => /(https?|www\.|\.(com|net|org|io|ru|xyz|info|top|co)\b|@)/i.test(s)

/** The keyword as stored (trimmed, single spaces, lower case), or null when it is not allowed. */
export function cleanAlertKeyword(raw: string): string | null {
  const k = raw.trim().replace(/\s+/g, ' ')
  return KEYWORD.test(k) && !looksLikeLink(k) ? k.toLowerCase() : null
}
