import { dedupeLatest } from '../../lib/jobs/latestSelection'

let n = 0
const job = (countryCode: string, companyId: string, remote = false) =>
  ({ id: `j${++n}`, title: `Role ${n}`, companyId, countryCode, remote, minAnnual: 1, maxAnnual: 2 }) as never

describe('dedupeLatest', () => {
  it('keeps at most 3 jobs per market, newest first, when there is enough variety', () => {
    const jobs = [
      ...Array.from({ length: 8 }, (_, i) => job('CH', `ch${i}`)),
      job('US', 'u1'), job('US', 'u2'), job('GB', 'g1'), job('CA', 'c1'), job('DE', 'd1'),
      job('US', 'u3', true), job('US', 'u4'),
    ]
    const picked = dedupeLatest(jobs, 10) as Array<{ countryCode: string }>
    expect(picked).toHaveLength(10)
    expect(picked.filter((j) => j.countryCode === 'CH')).toHaveLength(3)
    expect(picked.map((j) => (jobs as Array<{ id: string }>).findIndex((x) => x === (j as unknown)))).toEqual(
      [...picked.map((j) => (jobs as Array<{ id: string }>).findIndex((x) => x === (j as unknown)))].sort((a, b) => a - b),
    )
  })

  it('still fills the list when the newest jobs are all one market', () => {
    const jobs = Array.from({ length: 12 }, (_, i) => job('CH', `c${i}`))
    expect(dedupeLatest(jobs, 10)).toHaveLength(10)
  })

  it('keeps the employer cap even when filling', () => {
    const jobs = Array.from({ length: 12 }, () => job('CH', 'same'))
    expect(dedupeLatest(jobs, 10)).toHaveLength(2)
  })
})
