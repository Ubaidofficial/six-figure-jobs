import { isTier1Role } from './canonicalSlugs'
import { findBestMatchingRole } from './slugMatcher'

const SENIORITY_PREFIXES = new Set(['senior', 'sr', 'staff', 'principal', 'lead', 'junior', 'mid'])

function normalize(raw?: string | null): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

function stripSeniorityPrefix(slug: string): string {
  const parts = slug.split('-').filter(Boolean)
  let index = 0
  while (index < parts.length && SENIORITY_PREFIXES.has(parts[index])) {
    index += 1
  }
  return parts.slice(index).join('-')
}

/**
 * Resolve a role slug to a tier-1 indexable slug for internal linking.
 * Returns null when no safe tier-1 mapping exists.
 */
export function resolveIndexableRoleSlug(raw?: string | null): string | null {
  const normalized = normalize(raw)
  if (!normalized) return null

  if (isTier1Role(normalized)) return normalized

  const directMatch = findBestMatchingRole(normalized)
  if (directMatch && isTier1Role(directMatch)) return directMatch

  const strippedFromInput = stripSeniorityPrefix(normalized)
  if (strippedFromInput && isTier1Role(strippedFromInput)) return strippedFromInput

  const strippedFromMatch = directMatch ? stripSeniorityPrefix(directMatch) : ''
  if (strippedFromMatch && isTier1Role(strippedFromMatch)) return strippedFromMatch

  const fallbackMatch = strippedFromInput ? findBestMatchingRole(strippedFromInput) : null
  if (fallbackMatch && isTier1Role(fallbackMatch)) return fallbackMatch

  return null
}

const SENIORITY_WORDS = new Set(['senior', 'sr', 'staff', 'principal', 'lead', 'junior', 'jr', 'mid', 'i', 'ii', 'iii', 'iv'])
const NOISE_WORDS = new Set(['and', 'of', 'the', 'for'])

function titleWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
}

/** The job title without its team/qualifier tail ("Engineering Manager, Maps" -> "Engineering Manager"). */
function titleHead(title: string): string {
  return title.split(/[,(|–—]|\s-\s/)[0].trim()
}

/** The role's own words, without seniority, that must all show up in the title for a title-based match to be believed. */
function roleWords(slug: string): string[] {
  return slug.split('-').filter((w) => w && !SENIORITY_WORDS.has(w))
}

/**
 * The indexable role a job belongs to. Uses the stored role slug; when that is `other` (the ingest only keeps slugs
 * that are canonical as written, so "Senior Staff Software Engineer, Ads Content Safety" is stored as `other`) it
 * reads the role from the title instead. The title match is fuzzy, so it is only trusted when every word of the role
 * appears in the title, next to each other: "UX Writer" never becomes "ux-researcher", "Product Marketing Manager" never "product-manager".
 */
export function resolveJobRoleSlug(job: { roleSlug?: string | null; title?: string | null }): string | null {
  const stored = resolveIndexableRoleSlug(job.roleSlug)
  if (stored) return stored

  const title = String(job.title || '')
  const head = titleHead(title)
  if (!head) return null
  const words = titleWords(head)
  const fromTitle = resolveIndexableRoleSlug(words.join('-'))
  if (!fromTitle) return null

  const wanted = roleWords(fromTitle)
  const same = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a)
  const contiguous = words.some((_, i) => wanted.length > 0 && wanted.every((w, k) => i + k < words.length && same(words[i + k], w)))
  return contiguous ? fromTitle : null
}

/** Search words for "similar jobs" when no role could be resolved: the title head without seniority. */
export function similarJobsKeyword(title: string | null | undefined): string | null {
  const words = titleWords(titleHead(String(title || ''))).filter((w) => !SENIORITY_WORDS.has(w) && !NOISE_WORDS.has(w))
  return words.length >= 2 ? words.join(' ') : null
}
