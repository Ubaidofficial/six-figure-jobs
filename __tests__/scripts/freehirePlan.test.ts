const { decideFreehireMode, fallbackMode } = require('../../scripts/freehire-plan.js')

const NOW = Date.parse('2026-11-13T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString()
const job = (name: string, h: number | null, conclusion: string | null = 'success') => ({
  name,
  startedAt: h === null ? null : hoursAgo(h),
  conclusion,
})

describe('decideFreehireMode', () => {
  it('runs a full sync when no full run started in the last 20 hours', () => {
    expect(decideFreehireMode([], NOW)).toBe('full')
    expect(decideFreehireMode([job('sync (full)', 21), job('sync (light)', 1)], NOW)).toBe('full')
  })

  it('runs a light sync 5.5 hours after the last sync of any kind', () => {
    expect(decideFreehireMode([job('sync (full)', 6)], NOW)).toBe('light')
    expect(decideFreehireMode([job('sync (full)', 12), job('sync (light)', 6)], NOW)).toBe('light')
    expect(decideFreehireMode([job('sync (full)', 12), job('sync (manual)', 5.6)], NOW)).toBe('light')
  })

  it('skips when a sync started recently', () => {
    expect(decideFreehireMode([job('sync (full)', 5)], NOW)).toBe('skip')
    expect(decideFreehireMode([job('sync (full)', 12), job('sync (light)', 1)], NOW)).toBe('skip')
    expect(decideFreehireMode([job('sync (full)', 12), job('sync (manual)', 2)], NOW)).toBe('skip')
  })

  it('counts failed runs, so a failing full run is not retried every hour', () => {
    expect(decideFreehireMode([job('sync (full)', 3, 'failure')], NOW)).toBe('skip')
    expect(decideFreehireMode([job('sync (full)', 7, 'failure')], NOW)).toBe('light')
  })

  it('ignores skipped and never-started jobs', () => {
    expect(decideFreehireMode([job('sync (full)', 1, 'skipped'), job('sync (light)', null, null)], NOW)).toBe('full')
  })

  it('treats the old "sync" job name as a full run and manual runs as not full', () => {
    expect(decideFreehireMode([job('sync', 10)], NOW)).toBe('light')
    expect(decideFreehireMode([job('sync (manual)', 10)], NOW)).toBe('full')
  })
})

describe('fallbackMode', () => {
  it('keeps the old fixed times', () => {
    expect(fallbackMode(Date.parse('2026-11-13T05:17:00Z'))).toBe('full')
    expect(fallbackMode(Date.parse('2026-11-13T17:17:00Z'))).toBe('light')
    expect(fallbackMode(Date.parse('2026-11-13T08:17:00Z'))).toBe('skip')
  })
})
