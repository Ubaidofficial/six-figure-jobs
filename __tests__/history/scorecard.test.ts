import { diffMetrics, flattenMetrics, renderScorecard, SCORECARD_VERSION, type ScorecardMetrics } from '../../lib/history/scorecard'

const metrics = (over: Partial<ScorecardMetrics> = {}): ScorecardMetrics => ({
  version: SCORECARD_VERSION,
  jobs: { live: 1000, salaryValidated: 990, withPostedAt: 900, remote: 200, remoteWithCountry: 150, withBenefits: 50, withTechStack: 400, withAiOneLiner: 2, withExpiresAt: 10, visaFlagged: 250, hiddenByAge: 300, keptAliveOld: 100 },
  companies: { total: 500, website: 200, logo: 100, description: 5, industry: 0, employeeCount: 0, fundingStage: 0, headquarters: 0, foundedYear: 10, sizeBucket: 0, country: 20, linkedin: 2 },
  evidence: { rows: 12, benefits: 10, remoteMode: 2 },
  reports: { last7d: 3, last30d: 8, 'wrong-salary.last7d': 2, 'wrong-salary.last30d': 5 },
  clicks: { last7d: 40, last30d: 100, distinctJobs30d: 60 },
  history: { lifecycleTracked: 1000, lifecycleExpiredObserved: 5, lifecycleReopened: 0, lifecyclePayChanged: 1, marketSnapshotRows: 300 },
  latest: { marketSnapshot: '2026-11-16', clickRollup: null },
  ...over,
})

describe('flattenMetrics / diffMetrics', () => {
  it('flattens the numeric groups to dotted keys and leaves the dates out', () => {
    const flat = flattenMetrics(metrics())
    expect(flat['jobs.live']).toBe(1000)
    expect(flat['reports.wrong-salary.last7d']).toBe(2)
    expect(Object.keys(flat).some((k) => k.startsWith('latest'))).toBe(false)
  })

  it('subtracts previous from current for the keys both have, and skips new ones', () => {
    const prev = metrics()
    const curr = metrics({ jobs: { ...prev.jobs, live: 1100, withBenefits: 80, newThing: 5 } })
    const d = diffMetrics(prev, curr)
    expect(d['jobs.live']).toBe(100)
    expect(d['jobs.withBenefits']).toBe(30)
    expect(d['jobs.salaryValidated']).toBe(0)
    expect('jobs.newThing' in d).toBe(false)
  })
})

describe('renderScorecard', () => {
  it('shows each share and its change in percentage points since the last scorecard', () => {
    const prev = metrics()
    const curr = metrics({ jobs: { ...prev.jobs, withBenefits: 150 } }) // 5.0% -> 15.0%
    const text = renderScorecard(curr, prev, '2026-11-23')
    expect(text).toContain('## Data scorecard, 2026-11-23')
    expect(text).toContain('| Has benefits listed | 150 | 1,000 | 15.0% | +10 pp |')
    expect(text).toContain('| Company website | 200 | 500 | 40.0% | 0 pp |')
    expect(text).toContain('| Remote jobs with a country | 150 | 200 | 75.0% | 0 pp |')
  })

  it('says so when there is no earlier scorecard, and shows no change', () => {
    const text = renderScorecard(metrics(), null, '2026-11-16')
    expect(text).toContain('First scorecard')
    expect(text).toContain('| Has benefits listed | 50 | 1,000 | 5.0% | - |')
  })

  it('does not divide by zero, and skips a field a stored older scorecard did not have', () => {
    const empty = metrics({ jobs: { ...metrics().jobs, remote: 0, remoteWithCountry: 0 } })
    expect(renderScorecard(empty, null, 'x')).toContain('| Remote jobs with a country | 0 | 0 | - | - |')
    const old = metrics({ companies: { total: 500 } })
    expect(() => renderScorecard(metrics(), old, 'x')).not.toThrow()
    expect(renderScorecard(metrics(), old, 'x')).toContain('| Company website | 200 | 500 | 40.0% | - |')
  })

  it('lists the counts with their change', () => {
    const prev = metrics()
    const curr = metrics({ clicks: { ...prev.clicks, last7d: 55 } })
    expect(renderScorecard(curr, prev, 'x')).toContain('| Apply clicks, last 7 days | 55 | +15 |')
  })
})
