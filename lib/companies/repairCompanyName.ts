// lib/companies/repairCompanyName.ts
//
// Some job feeds hand us an ATS identifier where the employer's name should be: a bare UUID ("9c26369c-d400-…", an
// Ashby organisation), a name with a UUID tail ("neatdevs-llc-7d0fa42a-…", Gusto), a host and path
// ("app.loxo.co/reliance-one-1", "weber.wd115.myworkdayjobs.com/WB"), or a hex id (Paycor, ADP). Shown as is, a job
// page says "9c26369c-d400-4eb7-a9b3-ab8f6469f9e8 is hiring". This module recognises those names and recovers the real
// one from the name itself, the ATS board in the apply URL, or the first sentence of the description ("Amplitude is
// the leading AI analytics platform"), and returns null when it cannot, so the caller skips the job instead of
// publishing an id. A name that is not an id is returned exactly as given.

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const HAS_UUID = new RegExp(UUID, 'i')
const LONG_HEX = /^[0-9a-f]{16,}$/i
// ATS and recruiting-platform hosts: a name that is one of these addresses is the platform's, not an employer's.
const ATS_HOST = /(loxo|oraclecloud|myworkdayjobs|ashbyhq|greenhouse|lever\.co|workable|breezy|recruitee|teamtailor|bamboohr|catsone|taleo|icims|adp\.com|paycor|paylocity|smartrecruiters|jobvite|gusto|applytojob|rippling)/i

/** True for a company "name" that is really an identifier or an address. */
export function looksLikeIdName(name: string | null | undefined): boolean {
  const n = String(name ?? '').trim()
  if (!n) return false
  if (HAS_UUID.test(n) || LONG_HEX.test(n)) return true
  if (/\s/.test(n)) return false // real names have spaces ("Cantor Fitzgerald/BGC" does not count: its parts are words)
  if (/^[a-z0-9_-]+\/[a-z]*\d[\w.]*$/i.test(n)) return true // "activefence/d5.005"
  const host = n.split('/')[0]
  const labels = host.split('.')
  if (labels.length >= 2 && ATS_HOST.test(host)) return true
  // "pod6.app.loxo.co/inara-talent": a host with three or more labels (each at least two characters, so "U.S.Bank" is not
  // one), or a host followed by a path.
  return (labels.length >= 3 && labels.every((l) => l.length >= 2)) || (labels.length >= 2 && n.includes('/') && /\.[a-z]{2,}$/i.test(host))
}

const SUFFIX: Record<string, string> = {
  llc: 'LLC', ltd: 'Ltd', plc: 'PLC', llp: 'LLP', lp: 'LP', inc: 'Inc', corp: 'Corp', co: 'Co', gmbh: 'GmbH', ag: 'AG', sa: 'SA',
}

/** "neatdevs-llc" -> "Neatdevs LLC"; trailing counters ("reliance-one-1") are dropped. Null if it does not read as a name. */
export function prettySlug(slug: string): string | null {
  const words = slug
    .replace(new RegExp(`[\\s_:-]*${UUID}.*$`, 'i'), '')
    .split(/[\s_-]+/)
    .filter(Boolean)
  while (words.length > 1 && /^\d+$/.test(words[words.length - 1])) words.pop()
  const out = words.map((w) => SUFFIX[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  const letters = out.replace(/[^a-z]/gi, '').length
  // Needs four letters and mostly letters: "CX", "WB" and "d5.005" are site codes, not companies.
  return letters >= 4 && letters / out.replace(/\s/g, '').length >= 0.7 ? out : null
}

// Platforms that give each employer its own subdomain: the first label is the employer.
const SUBDOMAIN_BOARD = /^([a-z0-9-]+)\.(?:wd\d+\.myworkdayjobs\.com|recruitee\.com|teamtailor\.com|bamboohr\.com|breezy\.hr|catsone\.com)$/
const TWO_PART_TLD = /^(co|com|org|net|ac|gov)\.[a-z]{2}$/

/** The employer in a bare host: its own domain ("jobs.aecon.com" -> Aecon) or a platform subdomain ("akina.catsone.com" -> Akina). */
function fromHost(host: string): string | null {
  const h = host.toLowerCase()
  const sub = h.match(SUBDOMAIN_BOARD)?.[1]
  if (sub) return prettySlug(sub)
  if (ATS_HOST.test(h)) return null // a platform address with a tenant code (Oracle, ADP, Paycor...): no employer name in it
  const labels = h.split('.')
  const registrable = TWO_PART_TLD.test(labels.slice(-2).join('.')) ? 3 : 2
  return labels.length >= registrable ? prettySlug(labels[labels.length - registrable]) : null
}

/** The name the name itself still carries once its identifier is removed, or null. */
function fromName(name: string): string | null {
  if (HAS_UUID.test(name)) return LONG_HEX.test(name) ? null : prettySlug(name)
  if (LONG_HEX.test(name)) return null
  const slash = name.indexOf('/')
  if (slash < 0) return name.includes('.') ? fromHost(name) : null
  const [head, tail] = [name.slice(0, slash), name.slice(slash + 1)]
  // "activefence/d5.005": the head is the name, the tail a code. "app.loxo.co/reliance-one-1": the tail is the name.
  if (!head.includes('.')) return prettySlug(head)
  return prettySlug(tail) ?? fromHost(head)
}

/** The company handle in an ATS board URL (jobs.ashbyhq.com/<company>/…), or null for other URLs. */
export function boardSlugFromUrl(url: string | null | undefined): string | null {
  let u: URL
  try {
    u = new URL(String(url ?? ''))
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  const first = u.pathname.split('/').filter(Boolean)[0]
  let slug: string | undefined
  if (host === 'jobs.ashbyhq.com' || host === 'jobs.lever.co' || host === 'apply.workable.com' || host === 'jobs.smartrecruiters.com') slug = first
  else if (/^(job-)?boards(\.eu)?\.greenhouse\.io$/.test(host)) slug = first
  else slug = host.match(SUBDOMAIN_BOARD)?.[1]
  if (!slug || HAS_UUID.test(slug) || LONG_HEX.test(slug)) return null
  return slug
}

const NOT_A_NAME = new Set(['we', 'our', 'the', 'this', 'that', 'as', 'at', 'in', 'on', 'you', 'your', 'join', 'if', 'for', 'with', 'are', 'do', 'welcome', 'about', 'a', 'an', 'what', 'who', 'it', 'there'])

/** "Amplitude is the leading AI analytics platform…" -> "Amplitude". Null unless a block opens with a name and a verb. */
export function nameFromDescription(html: string | null | undefined): string | null {
  // Each block (paragraph, heading, line) is read on its own, so a heading and the sentence after it never run together.
  const blocks = String(html ?? '')
    .replace(/<\/(p|h[1-6]|li|div)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .split('\n')
    .map((b) => b.replace(/\s+/g, ' ').trim().replace(/^about\s+/i, ''))
    .filter(Boolean)
    .slice(0, 3)
  for (const text of blocks) {
    const m = text
      .slice(0, 300)
      .match(/^([A-Z][\w&.'-]*(?:\s+(?:[A-Z&][\w&.'-]*|of|and|for|the)){0,4})\s+(?:is|are|was|has|helps|provides|builds|offers|empowers|operates|develops|delivers|serves)\b/)
    if (!m) continue
    const candidate = m[1].replace(/\s+(?:of|and|for|the)$/i, '').trim()
    if (!NOT_A_NAME.has(candidate.split(' ')[0].toLowerCase())) return candidate
  }
  return null
}

/**
 * The company name to use: `name` unchanged unless it is an identifier or an address, in which case the real name is
 * recovered (from the name, the apply URL's ATS board, or the description, in that order) or null is returned.
 */
export function repairCompanyName(input: {
  name: string | null | undefined
  applyUrl?: string | null
  descriptionHtml?: string | null
}): string | null {
  const name = String(input.name ?? '').trim()
  if (!name) return null
  if (!looksLikeIdName(name)) return name
  const board = boardSlugFromUrl(input.applyUrl)
  return fromName(name) ?? (board ? prettySlug(board) : null) ?? nameFromDescription(input.descriptionHtml)
}

/**
 * What to change on an already-stored job when the company it is stored under is an identifier ("9c26369c-d400-…") and
 * a real company has now been resolved for it: the company name and id, and the dedupe key (which includes the company
 * id). Empty when the stored name is a real one or nothing changed, so jobs are only ever moved off a placeholder.
 */
export function relinkToRepairedCompany(
  existing: { company?: string | null; companyId?: string | null },
  company: { id: string; name: string },
  dedupeKey: string,
): { company?: string; companyId?: string; dedupeKey?: string } {
  if (!looksLikeIdName(existing.company) || existing.companyId === company.id) return {}
  return { company: company.name, companyId: company.id, dedupeKey }
}
