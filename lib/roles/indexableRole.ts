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
