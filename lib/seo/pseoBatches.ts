// lib/seo/pseoBatches.ts
//
// Batched release of the programmatic (pSEO) pages that lib/seo/pseoUnlock.ts makes eligible.
//
// A new, low-authority site gets crawled but indexes slowly; submitting ~60+ new templated URLs at once is the
// pattern that ends in "Crawled - currently not indexed". Instead the pages are split into batches that are released
// one at a time. A page is only released when BOTH hold, so the sitemap and the page can never disagree:
//   - the sitemap file for its batch lists it (/sitemap-batch/<n>.xml), and
//   - its own robots tag says `index` (unreleased pages serve `noindex, follow`).
// Each batch has its own sitemap file so Search Console reports indexing coverage per batch.
//
// Release control (env, read at call time, no deploy needed):
//   PSEO_RELEASED_BATCH=<n>       highest released batch, default 1 (clamped to 1..PSEO_BATCH_COUNT)
//   PSEO_BATCH_SCHEDULE=<dates>   optional comma-separated ISO dates; batch 2 is released on the first date, batch 3
//                                 on the second, and so on. The higher of the two controls wins.
//
// Pages in the Phase 1 allowlist (role pages, salary guides, remote, blog) and the job sitemap are not batched.

export const PSEO_BATCH_COUNT = 4

// Batch 1: the broadest, highest-volume hubs, a small first signal to Google of what the site is about.
const BATCH1_SKILLS = new Set([
  'python', 'javascript', 'typescript', 'react', 'aws', 'kubernetes', 'docker', 'java', 'sql', 'machine-learning',
])
const BATCH1_CITIES = new Set(['new-york', 'san-francisco', 'london', 'toronto', 'seattle', 'austin'])
const BATCH1_LEVELS = new Set(['senior'])
const BATCH1_ROLES = new Set([
  'senior-software-engineer', 'senior-backend-engineer', 'senior-frontend-engineer', 'senior-data-engineer',
])
// Role × skill / city combos: the strongest roles first, and only over the batch 1 skills/cities (batch 3).
const COMBO_PRIORITY_ROLES = new Set([
  'software-engineer', 'backend-engineer', 'frontend-engineer', 'full-stack-engineer', 'data-engineer',
])

/** Which batch a pSEO path belongs to, or null when the path is not batched. Pure and static (no data lookups). */
export function getPseoBatch(path: string): number | null {
  const parts = path.split('?')[0].split('/').filter(Boolean)
  if (parts[0] !== 'jobs') return null

  if (parts.length === 3 && parts[1] === 'skills') return BATCH1_SKILLS.has(parts[2]) ? 1 : 2
  if (parts.length === 3 && parts[1] === 'city') return BATCH1_CITIES.has(parts[2]) ? 1 : 2
  if (parts.length === 3 && parts[1] === 'level') return BATCH1_LEVELS.has(parts[2]) ? 1 : 2

  // /jobs/<role>
  if (parts.length === 2 && !['skills', 'city', 'level', 'category', 'location', 'state', 'industry'].includes(parts[1])) {
    return BATCH1_ROLES.has(parts[1]) ? 1 : 2
  }

  // /jobs/<role>/skills/<skill> and /jobs/<role>/city/<city>
  if (parts.length === 4 && (parts[2] === 'skills' || parts[2] === 'city')) {
    const top = parts[2] === 'skills' ? BATCH1_SKILLS.has(parts[3]) : BATCH1_CITIES.has(parts[3])
    return COMBO_PRIORITY_ROLES.has(parts[1]) && top ? 3 : 4
  }
  return null
}

function clampBatch(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(PSEO_BATCH_COUNT, Math.max(1, Math.trunc(n)))
}

/** Highest released batch right now: the manual variable or the schedule, whichever is further along. */
export function getReleasedPseoBatch(now: number = Date.now()): number {
  const manual = clampBatch(Number.parseInt(process.env.PSEO_RELEASED_BATCH ?? '1', 10))
  const dates = String(process.env.PSEO_BATCH_SCHEDULE ?? '')
    .split(',')
    .map((d) => Date.parse(d.trim()))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)
  const scheduled = clampBatch(1 + dates.filter((t) => t <= now).length)
  return Math.max(manual, scheduled)
}

/** True when the path is not batched, or its batch has been released. */
export function isPseoBatchReleased(path: string, now: number = Date.now()): boolean {
  const batch = getPseoBatch(path)
  return batch === null || batch <= getReleasedPseoBatch(now)
}

/** Batches that are released and therefore advertised in sitemap.xml. */
export function getReleasedBatchNumbers(now: number = Date.now()): number[] {
  const released = getReleasedPseoBatch(now)
  return Array.from({ length: released }, (_, i) => i + 1)
}
