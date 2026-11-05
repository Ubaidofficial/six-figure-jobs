import {
  PSEO_BATCH_COUNT,
  getPseoBatch,
  getReleasedBatchNumbers,
  getReleasedPseoBatch,
  isPseoBatchReleased,
} from '../../lib/seo/pseoBatches'
import { isPseoComboIndexable, isPseoHubUnlocked } from '../../lib/seo/pseoUnlock'
import { __resetIndexingPhaseCacheForTests } from '../../lib/seo/indexingPhase'

const DAY = 24 * 60 * 60 * 1000

describe('getPseoBatch', () => {
  it('assigns hubs, roles and combos to their batch', () => {
    expect(getPseoBatch('/jobs/skills/python')).toBe(1)
    expect(getPseoBatch('/jobs/skills/nextjs')).toBe(2)
    expect(getPseoBatch('/jobs/city/new-york')).toBe(1)
    expect(getPseoBatch('/jobs/city/denver')).toBe(2)
    expect(getPseoBatch('/jobs/level/senior')).toBe(1)
    expect(getPseoBatch('/jobs/level/mid')).toBe(2)
    expect(getPseoBatch('/jobs/senior-software-engineer')).toBe(1)
    expect(getPseoBatch('/jobs/site-reliability-engineer')).toBe(2)
    expect(getPseoBatch('/jobs/software-engineer/skills/python')).toBe(3)
    expect(getPseoBatch('/jobs/software-engineer/city/new-york')).toBe(3)
    expect(getPseoBatch('/jobs/software-engineer/skills/nextjs')).toBe(4)
    expect(getPseoBatch('/jobs/product-manager/skills/python')).toBe(4)
  })

  it('does not batch pages outside the pSEO set', () => {
    for (const p of ['/', '/salary', '/remote/software-engineer', '/jobs/category/engineering', '/jobs/location/united-states', '/blog/x', '/jobs/software-engineer/remote']) {
      expect(getPseoBatch(p)).toBeNull()
      expect(isPseoBatchReleased(p)).toBe(true)
    }
  })
})

describe('release control', () => {
  beforeEach(() => {
    process.env.INDEXING_PHASE = '1' // jest.setup.js defaults to 2; the batch gate is a phase 1 mechanism
    __resetIndexingPhaseCacheForTests()
    delete process.env.PSEO_RELEASED_BATCH
    delete process.env.PSEO_BATCH_SCHEDULE
    delete process.env.PSEO_UNLOCK
  })
  afterAll(() => {
    delete process.env.PSEO_RELEASED_BATCH
    delete process.env.PSEO_BATCH_SCHEDULE
    process.env.INDEXING_PHASE = '2'
    __resetIndexingPhaseCacheForTests()
  })

  it('releases only batch 1 by default', () => {
    expect(getReleasedPseoBatch()).toBe(1)
    expect(getReleasedBatchNumbers()).toEqual([1])
    expect(isPseoBatchReleased('/jobs/skills/python')).toBe(true)
    expect(isPseoBatchReleased('/jobs/skills/nextjs')).toBe(false)
    expect(isPseoBatchReleased('/jobs/software-engineer/skills/python')).toBe(false)
  })

  it('follows PSEO_RELEASED_BATCH and clamps it', () => {
    process.env.PSEO_RELEASED_BATCH = '3'
    expect(getReleasedBatchNumbers()).toEqual([1, 2, 3])
    process.env.PSEO_RELEASED_BATCH = '99'
    expect(getReleasedPseoBatch()).toBe(PSEO_BATCH_COUNT)
    process.env.PSEO_RELEASED_BATCH = '0'
    expect(getReleasedPseoBatch()).toBe(1)
    process.env.PSEO_RELEASED_BATCH = 'abc'
    expect(getReleasedPseoBatch()).toBe(1)
  })

  it('releases a batch on each scheduled date', () => {
    const now = Date.parse('2026-11-20T00:00:00Z')
    process.env.PSEO_BATCH_SCHEDULE = '2026-11-12, 2026-11-19, 2026-11-26'
    expect(getReleasedPseoBatch(now)).toBe(3)
    expect(getReleasedPseoBatch(now - 10 * DAY)).toBe(1)
    expect(getReleasedPseoBatch(now + 10 * DAY)).toBe(4)
  })

  it('takes the further-along of the manual value and the schedule, and ignores bad dates', () => {
    const now = Date.parse('2026-11-20T00:00:00Z')
    process.env.PSEO_BATCH_SCHEDULE = '2026-11-12,not-a-date'
    process.env.PSEO_RELEASED_BATCH = '3'
    expect(getReleasedPseoBatch(now)).toBe(3)
    process.env.PSEO_RELEASED_BATCH = '1'
    expect(getReleasedPseoBatch(now)).toBe(2)
  })

  it('leaves combo pages ungated in phase 2', () => {
    process.env.INDEXING_PHASE = '2'
    __resetIndexingPhaseCacheForTests()
    expect(isPseoComboIndexable(50, '/jobs/software-engineer/skills/python')).toBe(true)
  })

  it('gates the page-level unlock helpers by batch', () => {
    expect(isPseoHubUnlocked(500, '/jobs/skills/python')).toBe(true)
    expect(isPseoHubUnlocked(500, '/jobs/skills/nextjs')).toBe(false) // batch 2 not released
    expect(isPseoComboIndexable(50, '/jobs/software-engineer/skills/python')).toBe(false) // batch 3 not released
    process.env.PSEO_RELEASED_BATCH = '3'
    expect(isPseoHubUnlocked(500, '/jobs/skills/nextjs')).toBe(true)
    expect(isPseoComboIndexable(50, '/jobs/software-engineer/skills/python')).toBe(true)
    expect(isPseoComboIndexable(4, '/jobs/software-engineer/skills/python')).toBe(false) // below the page floor
  })
})
