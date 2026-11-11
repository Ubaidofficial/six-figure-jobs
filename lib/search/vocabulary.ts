// The words that appear in active jobs (titles, companies, skills, locations), used to correct typos in searches
// and to offer the most common skills as filters. Built from the database and cached in memory.

import { memoAsync } from '../cache/memo'
import { prisma } from '../prisma'
import type { Vocabulary } from './keywordPlan'

const TTL_MS = 30 * 60 * 1000
const MAX_ROWS = 20_000

export type SearchVocabulary = Vocabulary & {
  /** Most common skills (whole skill names), for the Technology filter. */
  topSkills: Array<{ term: string; count: number }>
}

export function parseSkillList(raw: string | null | undefined): string[] {
  if (!raw) return []
  const text = raw.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
  } catch {
    // not JSON: comma separated
  }
  return text.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
}

const words = (text: string | null | undefined, min: number) =>
  (text ?? '').toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length >= min)

export function buildVocabulary(
  rows: Array<{ title: string | null; company: string | null; locationRaw: string | null; techStack: string | null; skillsJson: string | null }>,
): SearchVocabulary {
  const counts = new Map<string, number>()
  const skillCounts = new Map<string, number>()
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

  for (const r of rows) {
    for (const w of words(r.title, 3)) bump(counts, w)
    for (const w of words(r.company, 3)) bump(counts, w)
    for (const w of words(r.locationRaw, 4)) bump(counts, w)
    const skills = new Set([...parseSkillList(r.skillsJson), ...parseSkillList(r.techStack)])
    for (const s of skills) {
      bump(skillCounts, s)
      for (const w of words(s, 3)) bump(counts, w)
    }
  }

  const topSkills = [...skillCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16)
    .map(([term, count]) => ({ term, count }))

  return { counts, terms: [...counts.keys()], topSkills }
}

/**
 * Through the shared cache (lib/cache/memo.ts): one load at a time, and after 30 minutes the old vocabulary is served
 * while a new one loads in the background. It had its own cache with neither, so at each expiry every request (the
 * /jobs page, every keyword search) read the same 20,000 rows at once and waited for them.
 */
export async function getSearchVocabulary(now: number = Date.now()): Promise<SearchVocabulary> {
  return memoAsync(
    'search-vocabulary',
    TTL_MS,
    async () => {
      const rows = await prisma.job.findMany({
        where: { isExpired: false },
        select: { title: true, company: true, locationRaw: true, techStack: true, skillsJson: true },
        take: MAX_ROWS,
      })
      return buildVocabulary(rows)
    },
    () => now,
  )
}
