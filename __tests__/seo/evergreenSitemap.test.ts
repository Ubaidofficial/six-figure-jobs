import { __resetEvergreenSitemapCacheForTests, collectEvergreenEntries } from '../../lib/seo/evergreenSitemap'

const aggregate = jest.fn()

jest.mock('../../lib/prisma', () => ({ prisma: { job: { aggregate: (...a: unknown[]) => aggregate(...a) } } }))
jest.mock('../../lib/jobs/queryJobs', () => ({
  buildWhere: (input: { roleSlugs?: string[]; remoteOnly?: boolean }) => ({
    kind: input.remoteOnly ? 'remote' : 'jobs',
    role: input.roleSlugs?.[0],
  }),
  buildHighSalaryEligibilityWhere: () => ({}),
  buildGlobalExclusionsWhere: () => ({}),
}))

const LATEST = new Date('2026-11-04T10:00:00.000Z')
const ROLE_LATEST = new Date('2026-11-03T08:00:00.000Z')

/** counts[role] = { jobs, salary, remote } */
function mockDb(counts: Record<string, { jobs: number; salary: number; remote: number }>) {
  aggregate.mockImplementation(async ({ where, _count }: { where: any; _count?: unknown }) => {
    if (!_count) return { _max: { updatedAt: LATEST } } // newest job overall
    const role = where.role ?? where.roleSlug
    const c = counts[role] ?? { jobs: 0, salary: 0, remote: 0 }
    const n = where.kind === 'remote' ? c.remote : where.kind === 'jobs' ? c.jobs : c.salary
    return { _count: { _all: n }, _max: { updatedAt: n > 0 ? ROLE_LATEST : null } }
  })
}

const paths = (entries: Array<{ path: string }>) => entries.map((e) => e.path)

describe('collectEvergreenEntries (phase 1)', () => {
  beforeEach(() => {
    __resetEvergreenSitemapCacheForTests()
    aggregate.mockReset()
    process.env.INDEXING_PHASE = '1'
    delete process.env.SEO_INDEXATION_PHASE
  })

  it('lists the pillars with the newest job update as lastmod', async () => {
    mockDb({})
    const entries = await collectEvergreenEntries(1)
    expect(paths(entries)).toEqual(expect.arrayContaining(['/', '/jobs', '/salary', '/companies', '/remote']))
    for (const e of entries.filter((x) => ['/', '/jobs'].includes(x.path))) {
      expect(e.lastmod).toEqual(LATEST)
    }
  })

  it('applies each page type’s own indexability threshold', async () => {
    mockDb({
      'software-engineer': { jobs: 3, salary: 1, remote: 5 }, // exactly at every threshold
      'data-engineer': { jobs: 2, salary: 0, remote: 4 }, // just below every threshold
    })
    const p = paths(await collectEvergreenEntries(1))
    expect(p).toEqual(expect.arrayContaining(['/jobs/software-engineer', '/salary/software-engineer', '/remote/software-engineer']))
    expect(p).not.toContain('/jobs/data-engineer')
    expect(p).not.toContain('/salary/data-engineer')
    expect(p).not.toContain('/remote/data-engineer')
  })

  it('never lists roles outside the phase 1 allowlist', async () => {
    mockDb({ 'account-executive': { jobs: 50, salary: 50, remote: 50 } })
    expect(paths(await collectEvergreenEntries(1)).some((x) => x.includes('account-executive'))).toBe(false)
  })

  it('uses the newest job update behind a page as its lastmod, not the request time', async () => {
    mockDb({ 'software-engineer': { jobs: 5, salary: 5, remote: 5 } })
    const e = (await collectEvergreenEntries(1)).find((x) => x.path === '/jobs/software-engineer')
    expect(e?.lastmod).toEqual(ROLE_LATEST)
  })

  it('includes the blog hub and posts while the blog family is not advertised', async () => {
    mockDb({})
    const p = paths(await collectEvergreenEntries(1))
    expect(p).toContain('/blog')
    expect(p.some((x) => x.startsWith('/blog/'))).toBe(true)
  })

  it('degrades to pillars without lastmod when the database is unreachable, and does not cache that', async () => {
    aggregate.mockRejectedValue(new Error('db down'))
    const down = await collectEvergreenEntries(1)
    expect(down.filter((e) => e.path.startsWith('/jobs/') || e.path.startsWith('/salary/'))).toHaveLength(0)
    expect(down.find((e) => e.path === '/')?.lastmod).toBeNull()

    mockDb({ 'software-engineer': { jobs: 5, salary: 5, remote: 5 } })
    const up = await collectEvergreenEntries(2) // 1 ms later: would still be cached if the failure had been cached
    expect(paths(up)).toContain('/jobs/software-engineer')
  })

  it('caches a complete result for an hour', async () => {
    mockDb({ 'software-engineer': { jobs: 5, salary: 5, remote: 5 } })
    await collectEvergreenEntries(1_000)
    const calls = aggregate.mock.calls.length
    await collectEvergreenEntries(1_000 + 59 * 60 * 1000)
    expect(aggregate.mock.calls.length).toBe(calls)
    await collectEvergreenEntries(1_000 + 61 * 60 * 1000)
    expect(aggregate.mock.calls.length).toBeGreaterThan(calls)
  })
})
