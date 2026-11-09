const mockQuery = jest.fn()
jest.mock('@/lib/jobs/queryJobs', () => ({ queryJobs: (...a: unknown[]) => mockQuery(...a) }))

import { __clearMemoForTests } from '@/lib/cache/memo'
import { BAND_SAMPLE_SIZE, loadBandSamples, pickBandSamples } from '@/lib/jobs/salaryBandSamples'

// The default USD bands: 100k, 150k, 200k, 300k (lower edges, as summarizeSalaries builds them).
const BANDS = [{ min: 100_000 }, { min: 150_000 }, { min: 200_000 }, { min: 300_000 }]

let n = 0
const job = (min: number, max: number, over: Record<string, unknown> = {}) => {
  n += 1
  return {
    id: `j${n}`,
    title: `Engineer ${n}`,
    company: `Company ${n}`,
    companyId: `c${n}`,
    companyRef: null,
    companyLogo: null,
    countryCode: 'US',
    locationRaw: 'Austin, TX',
    city: 'Austin',
    remote: false,
    remoteMode: 'onsite',
    minAnnual: BigInt(min),
    maxAnnual: BigInt(max),
    currency: 'USD',
    createdAt: new Date(Date.UTC(2026, 10, 6, 10, 0, 0) + n * 60_000),
    postedAt: null,
    updatedAt: new Date('2026-11-06T11:00:00Z'),
    ...over,
  } as any
}

beforeEach(() => {
  n = 0
  __clearMemoForTests()
  mockQuery.mockReset()
})

describe('pickBandSamples', () => {
  it('puts a job in the band its midpoint falls in, the same rule as the band counts', () => {
    // 90k-130k has a midpoint of 110k (first band); 140k-170k has 155k (second band), though its top is in the third.
    const [first, second, third, fourth] = pickBandSamples([job(90_000, 130_000), job(140_000, 170_000)], BANDS)
    expect(first.map((i) => i.title)).toEqual(['Engineer 1'])
    expect(second.map((i) => i.title)).toEqual(['Engineer 2'])
    expect(third).toEqual([])
    expect(fourth).toEqual([])
  })

  it('puts a midpoint exactly on an edge in the higher band, and anything from the last edge up in the last band', () => {
    const picked = pickBandSamples([job(150_000, 150_000), job(500_000, 700_000)], BANDS)
    expect(picked[1].map((i) => i.title)).toEqual(['Engineer 1'])
    expect(picked[3].map((i) => i.title)).toEqual(['Engineer 2'])
  })

  it('skips jobs that are not USD, have no salary, or sit below the first band', () => {
    const picked = pickBandSamples(
      [job(120_000, 140_000, { currency: 'GBP' }), job(0, 0, { minAnnual: null, maxAnnual: null }), job(40_000, 60_000)],
      BANDS,
    )
    expect(picked.flat()).toEqual([])
  })

  it('keeps the three newest per band, newest first', () => {
    // Later ids are newer; the pool is handed over newest first, as queryJobs returns it.
    const jobs = [1, 2, 3, 4, 5].map(() => job(110_000, 130_000)).reverse()
    const [first] = pickBandSamples(jobs, BANDS)
    expect(first).toHaveLength(BAND_SAMPLE_SIZE)
    expect(first.map((i) => i.title)).toEqual(['Engineer 5', 'Engineer 4', 'Engineer 3'])
  })

  it('returns one list per band, in band order, even when all are empty', () => {
    expect(pickBandSamples([], BANDS)).toEqual([[], [], [], []])
  })
})

describe('loadBandSamples', () => {
  it('reads three pages of the newest jobs and caches the result', async () => {
    mockQuery.mockImplementation(async ({ page }: { page: number }) => ({ jobs: page === 1 ? [job(210_000, 250_000)] : [] }))
    const first = await loadBandSamples(BANDS)
    expect(first[2].map((i) => i.title)).toEqual(['Engineer 1'])
    expect(mockQuery).toHaveBeenCalledTimes(3)
    expect(mockQuery.mock.calls.map((c) => c[0].page)).toEqual([1, 2, 3])
    expect(mockQuery.mock.calls.every((c) => c[0].pageSize === 100 && c[0].sortBy === 'date')).toBe(true)

    await loadBandSamples(BANDS)
    expect(mockQuery).toHaveBeenCalledTimes(3)
  })
})
