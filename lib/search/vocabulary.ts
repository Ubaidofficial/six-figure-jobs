// The words that appear in active jobs (titles, companies, skills, locations), used to correct typos in searches
// and to offer the most common skills as filters. Built from the database and cached in memory.

import { prisma } from '../prisma'
import type { Vocabulary } from './keywordPlan'

const TTL_MS = 30 * 60 * 1000
const MAX_ROWS = 20_000

export type SearchVocabulary = Vocabulary & {
  /** Most common skills (whole skill names), for the Technology filter. */
  topSkills: Array<{ term: string; count: number }>
}

let cache: { at: number; value: SearchVocabulary } | null = null

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

export async function getSearchVocabulary(now: number = Date.now()): Promise<SearchVocabulary> {
  if (cache && now - cache.at < TTL_MS) return cache.value
  const rows = await prisma.job.findMany({
    where: { isExpired: false },
    select: { title: true, company: true, locationRaw: true, techStack: true, skillsJson: true },
    take: MAX_ROWS,
  })
  const value = buildVocabulary(rows)
  cache = { at: now, value }
  return value
}

export function __resetVocabularyCacheForTests() {
  cache = null
}
