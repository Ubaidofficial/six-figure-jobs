// lib/roles/roleSuggestions.ts
//
// Live "search by role" suggestions for the homepage search box. Pure: the route supplies the live-job counts per
// role, this module turns them into ranked suggestions. Only roles that have jobs right now are ever suggested, so a
// suggestion is never a dead end, and matching is on whole word starts ("pm" never matches "development").

import { isCanonicalSlug } from './canonicalSlugs'
import { getSynonymsForRole } from './synonyms'

export type RoleCount = { slug: string; count: number }
export type RoleSuggestion = { slug: string; label: string; count: number }

// Same prefixes lib/normalizers/role.ts puts in front of a base role ("senior-seo-specialist" is a "seo-specialist").
const SENIORITY_PREFIX = /^(intern|junior|senior|staff|principal|lead|manager|director|vp|cxo|head)-/

const ACRONYMS = new Set(['seo', 'sem', 'ux', 'ui', 'qa', 'ml', 'ai', 'sdr', 'bdr', 'hr', 'it', 'sql', 'api', 'sre', 'crm', 'erp', 'sap', 'tpm', 'cto', 'cfo', 'ceo', 'vp', 'b2b', 'b2c', 'saas', 'aws'])

/** "seo-specialist" -> "SEO Specialist". */
export function roleLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

/**
 * Live-job counts per stored role slug -> counts per base role, so "senior-seo-specialist" jobs count for
 * "seo-specialist" (the role filter matches `roleSlug contains slug`, so a link to the base role finds them all).
 * `other` and slugs that are not canonical roles are dropped.
 */
export function aggregateRoleCounts(rows: Array<{ roleSlug: string | null; count: number }>): RoleCount[] {
  const byBase = new Map<string, number>()
  for (const { roleSlug, count } of rows) {
    if (!roleSlug || roleSlug === 'other' || !isCanonicalSlug(roleSlug) || !(count > 0)) continue
    const stripped = roleSlug.replace(SENIORITY_PREFIX, '')
    const base = isCanonicalSlug(stripped) ? stripped : roleSlug
    byBase.set(base, (byBase.get(base) ?? 0) + count)
  }
  return [...byBase.entries()].map(([slug, count]) => ({ slug, count }))
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+#\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Ranked suggestions for what the visitor has typed, or [] for under two characters. Ranking: the label starts with
 * the query, then a word of the label does, then an exact synonym ("swe", "pm"), then a synonym that starts with it;
 * ties go to the role with more jobs.
 */
export function suggestRoles(query: string, roles: RoleCount[], limit = 6): RoleSuggestion[] {
  const q = normalize(query)
  if (q.length < 2) return []

  const scored: Array<RoleSuggestion & { score: number }> = []
  for (const { slug, count } of roles) {
    if (!(count > 0)) continue
    const label = roleLabel(slug)
    const lower = normalize(label)
    let score = 0
    if (lower.startsWith(q)) score = 4
    else if (` ${lower}`.includes(` ${q}`)) score = 3
    else {
      const synonyms = getSynonymsForRole(slug).map(normalize)
      if (synonyms.includes(q)) score = 2.5
      else if (q.length >= 3 && synonyms.some((s) => s.startsWith(q))) score = 1.5
    }
    if (score > 0) scored.push({ slug, label, count, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ slug, label, count }) => ({ slug, label, count }))
}
