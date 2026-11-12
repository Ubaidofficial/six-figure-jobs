import { rankSalary } from '../../lib/jobs/salaryRank'
import { summarizeSalaries } from '../../lib/jobs/salarySnapshot'

jest.mock('../../lib/prisma', () => ({ prisma: {} }))
jest.mock('../../lib/jobs/queryJobs', () => ({ buildWhere: () => ({}) }))

const peers = (n: number, from = 100_000, step = 1_000) => Array.from({ length: n }, (_, i) => from + i * step)

describe('rankSalary', () => {
  it('needs enough peers to say anything', () => {
    expect(rankSalary(150_000, peers(14))).toBeNull()
    expect(rankSalary(150_000, [])).toBeNull()
  })

  it('returns the share of peers paid less and the median', () => {
    const r = rankSalary(150_000, peers(100))! // peers 100k..199k: 50 below, 1 tie (counts half) -> 50.5%
    expect(r.percent).toBe(51)
    expect(r.peers).toBe(100)
    expect(r.median).toBe(149_500)
  })

  it('is 0 at the bottom and near 100 at the top', () => {
    expect(rankSalary(50_000, peers(40))!.percent).toBe(0)
    expect(rankSalary(500_000, peers(40))!.percent).toBe(100)
  })

  it('counts ties as half so an exactly typical salary is about 50', () => {
    const r = rankSalary(120_000, Array(30).fill(120_000))!
    expect(r.percent).toBe(50)
  })

  it('ignores junk and rejects a bad own value', () => {
    expect(rankSalary(NaN, peers(30))).toBeNull()
    expect(rankSalary(0, peers(30))).toBeNull()
    expect(rankSalary(150_000, [...peers(20), NaN, -1, 0])!.peers).toBe(20)
  })

  it('gives the same median as the homepage snapshot for the same listings, plus the quartiles', () => {
    const values = peers(101)
    const r = rankSalary(150_000, values)!
    const snapshot = summarizeSalaries(values)!
    expect(r.median).toBe(snapshot.median)
    expect(r.p25).toBe(snapshot.p25)
    expect(r.p75).toBe(snapshot.p75)
    expect(r.p5).toBeLessThan(r.p25)
    expect(r.p95).toBeGreaterThan(r.p75)
  })
})
