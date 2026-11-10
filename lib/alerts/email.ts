// lib/alerts/email.ts
// Reading the address a visitor typed into an alert form. Pure (no Node APIs), so the form uses the same rules in the
// browser to suggest a fix before anything is sent.

// Zero-width characters come along when an address is copied from a web page or a chat, and make it undeliverable.
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g
// local@label.label.tld: the local part as mail servers accept it in practice (no spaces, quotes or brackets), domain
// labels of letters, digits and inner hyphens, and a TLD of letters or an internationalised one (xn--...).
const ADDRESS = /^([^\s@<>()[\]",;:\\]{1,64})@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59}))$/

/** The address as stored (trimmed, invisible characters removed, lower case), or null when it cannot be one. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.replace(INVISIBLE, '').trim().toLowerCase()
  if (email.length > 254 || !ADDRESS.test(email)) return null
  const local = email.slice(0, email.indexOf('@'))
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null
  return email
}

// The mailbox providers most job seekers use. A domain one or two typing slips away from one of these is almost
// certainly that one ("gmial.com", "hotmal.com"); anything further away is left alone.
const COMMON_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'yahoo.co.uk',
  'hotmail.co.uk',
  'gmx.de',
  'web.de',
]
// Providers with no country domains: any other ending on these names is a slip.
const SINGLE_DOMAIN = new Set(['gmail', 'googlemail', 'icloud', 'protonmail'])
// Mistyped endings of the common TLDs.
const TLD_FIXES: Record<string, string> = { con: 'com', cmo: 'com', ocm: 'com', vom: 'com', xom: 'com', comm: 'com', nte: 'net', ogr: 'org' }

/** Optimal string alignment distance (a swap of two neighbouring letters counts as one slip). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/**
 * "name@gmial.com" -> "name@gmail.com"; null when the domain looks right (or is unlike any common one). Only a
 * suggestion: the visitor decides, and an address on any other domain is accepted as typed.
 */
export function suggestEmailFix(raw: string): string | null {
  const email = normalizeEmail(raw)
  if (!email) return null
  const at = email.lastIndexOf('@')
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (COMMON_DOMAINS.includes(domain)) return null

  const name = domain.slice(0, domain.indexOf('.'))
  let best: { domain: string; d: number } | null = null
  for (const candidate of COMMON_DOMAINS) {
    const candidateName = candidate.slice(0, candidate.indexOf('.'))
    // Same provider, another country ending (outlook.de, yahoo.fr) is a real address, except for providers that
    // have only one domain (gmail.co is a slip).
    if (name === candidateName && !SINGLE_DOMAIN.has(name)) continue
    const d = distance(domain, candidate)
    // Short domains are close to many real ones (ae.com is one slip from me.com): none at 7 letters or fewer, one
    // slip up to 9 (gmial.com), two beyond (hotmial.com).
    const allowed = candidate.length <= 7 ? 0 : candidate.length <= 9 ? 1 : 2
    if (d > 0 && d <= allowed && (!best || d < best.d)) best = { domain: candidate, d }
  }
  if (best) return `${local}@${best.domain}`

  const dot = domain.lastIndexOf('.')
  const fixedTld = TLD_FIXES[domain.slice(dot + 1)]
  return fixedTld ? `${local}@${domain.slice(0, dot + 1)}${fixedTld}` : null
}
