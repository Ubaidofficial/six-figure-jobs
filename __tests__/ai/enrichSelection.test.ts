import {
  DEFAULT_DAILY_ENRICH_LIMIT,
  MAX_JOB_AGE_DAYS,
  MIN_DESCRIPTION_CHARS,
  enrichmentScore,
  isEnrichable,
  selectJobsToEnrich,
  type EnrichCandidate,
} from '@/lib/ai/enrichSelection'

const now = new Date('2026-11-13T12:00:00Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000)
let n = 0
const job = (over: Partial<EnrichCandidate> = {}): EnrichCandidate => ({
  id: `job-${++n}`,
  createdAt: hoursAgo(5),
  postedAt: hoursAgo(5),
  descriptionHtml: 'x'.repeat(MIN_DESCRIPTION_CHARS + 100),
  aiEnrichedAt: null,
  isExpired: false,
  maxAnnual: 150_000,
  currency: 'USD',
  companySlug: null,
  ...over,
})

describe('isEnrichable', () => {
  it('needs a live, not yet enriched, recent job with a description worth structuring', () => {
    expect(isEnrichable(job(), now)).toBe(true)
    expect(isEnrichable(job({ isExpired: true }), now)).toBe(false)
    expect(isEnrichable(job({ aiEnrichedAt: hoursAgo(1) }), now)).toBe(false)
    expect(isEnrichable(job({ descriptionHtml: 'short' }), now)).toBe(false)
    expect(isEnrichable(job({ descriptionHtml: null }), now)).toBe(false)
    expect(isEnrichable(job({ postedAt: hoursAgo((MAX_JOB_AGE_DAYS + 1) * 24), createdAt: hoursAgo(1) }), now)).toBe(false) // the posting date wins
    expect(isEnrichable(job({ postedAt: null, createdAt: hoursAgo(30) }), now)).toBe(true) // no posting date: first seen
  })
})

describe('enrichmentScore', () => {
  it('rewards pay as a multiple of the currency floor, a priority employer and freshness', () => {
    expect(enrichmentScore(job({ maxAnnual: 100_000, postedAt: hoursAgo(50) }), now)).toBe(0)
    expect(enrichmentScore(job({ maxAnnual: 160_000, postedAt: hoursAgo(50) }), now)).toBe(1)
    expect(enrichmentScore(job({ maxAnnual: 200_000, postedAt: hoursAgo(50) }), now)).toBe(2)
    expect(enrichmentScore(job({ maxAnnual: 400_000, postedAt: hoursAgo(50) }), now)).toBe(3)
    expect(enrichmentScore(job({ maxAnnual: 100_000, postedAt: hoursAgo(50), companySlug: 'acme' }), now, new Set(['acme']))).toBe(2)
    expect(enrichmentScore(job({ maxAnnual: 100_000, postedAt: hoursAgo(2) }), now)).toBe(1)
  })

  it('compares pay with the floor of its own currency, and copes with bigint and missing pay', () => {
    expect(enrichmentScore(job({ currency: 'GBP', maxAnnual: BigInt(150_000), postedAt: hoursAgo(50) }), now)).toBe(2) // 2x the GBP 75k floor
    expect(enrichmentScore(job({ currency: 'XXX', maxAnnual: 999_999, postedAt: hoursAgo(50) }), now)).toBe(0)
    expect(enrichmentScore(job({ maxAnnual: null, postedAt: hoursAgo(50) }), now)).toBe(0)
  })
})

describe('selectJobsToEnrich', () => {
  it('takes the best jobs up to the limit, skipping ineligible ones', () => {
    const top = job({ maxAnnual: 400_000 })
    const priority = job({ maxAnnual: 120_000, companySlug: 'acme' })
    const plain = job({ maxAnnual: 110_000 })
    const old = job({ maxAnnual: 900_000, postedAt: hoursAgo(24 * 10), createdAt: hoursAgo(24 * 10) })
    const done = job({ maxAnnual: 900_000, aiEnrichedAt: hoursAgo(1) })
    const picked = selectJobsToEnrich([plain, old, priority, done, top], { limit: 2, now, priorityCompanySlugs: new Set(['acme']) })
    expect(picked.map((j) => j.id)).toEqual([top.id, priority.id])
  })

  it('breaks ties by newest, then by id, so a rerun picks the same jobs', () => {
    const newer = job({ postedAt: hoursAgo(3) })
    const older = job({ postedAt: hoursAgo(40) })
    const a = job({ postedAt: hoursAgo(10), id: 'a' })
    const b = job({ postedAt: hoursAgo(10), id: 'b' })
    expect(selectJobsToEnrich([older, b, a, newer], { limit: 10, now }).map((j) => j.id)).toEqual([newer.id, 'a', 'b', older.id])
  })

  it('uses the default daily limit, and a limit of 0 picks nothing', () => {
    const many = Array.from({ length: DEFAULT_DAILY_ENRICH_LIMIT + 25 }, () => job())
    expect(selectJobsToEnrich(many, { now })).toHaveLength(DEFAULT_DAILY_ENRICH_LIMIT)
    expect(selectJobsToEnrich(many, { now, limit: 0 })).toEqual([])
  })
})
