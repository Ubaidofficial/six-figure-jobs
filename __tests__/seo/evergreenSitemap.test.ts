import { __resetEvergreenSitemapCacheForTests, collectEvergreenEntries } from '../../lib/seo/evergreenSitemap'

const aggregate = jest.fn()
const groupBy = jest.fn()

jest.mock('../../lib/prisma', () => ({
  prisma: { job: { aggregate: (...a: unknown[]) => aggregate(...a), groupBy: (...a: unknown[]) => groupBy(...a) } },
}))
jest.mock('../../lib/jobs/queryJobs', () => ({
  buildWhere: (input: {
    roleSlugs?: string[]
    remoteOnly?: boolean
    skillSlugs?: string[]
    citySlug?: string
    experienceLevel?: string
  }) => ({
    kind: input.remoteOnly ? 'remote' : 'jobs',
    role: input.roleSlugs?.[0],
    skill: input.skillSlugs?.[0],
    city: input.citySlug,
    level: input.experienceLevel,
  }),
  buildHighSalaryEligibilityWhere: () => ({}),
  buildGlobalExclusionsWhere: () => ({}),
}))

const LATEST = new Date('2026-11-04T10:00:00.000Z')
const ROLE_LATEST = new Date('2026-11-03T08:00:00.000Z')

type Pseo = {
  skills?: Record<string, number>
  cities?: Record<string, number>
  levels?: Record<string, number>
  combos?: Record<string, number> // `${role}/${skill|city}`
  roleGroups?: Array<{ roleSlug: string | null; count: number }>
}

/** counts[role] = { jobs, salary, remote }; pseo = counts for the skill / city / level / role x skill pages */
function mockDb(counts: Record<string, { jobs: number; salary: number; remote: number }>, pseo: Pseo = {}) {
  groupBy.mockResolvedValue(
    (pseo.roleGroups ?? []).map((g) => ({ roleSlug: g.roleSlug, _count: { _all: g.count }, _max: { updatedAt: ROLE_LATEST } })),
  )
  aggregate.mockImplementation(async ({ where, _count }: { where: any; _count?: unknown }) => {
    if (!_count) return { _max: { updatedAt: LATEST } } // newest job overall
    if (where.skill || where.city || where.level) {
      const n = where.role
        ? (pseo.combos?.[`${where.role}/${where.skill ?? where.city}`] ?? 0)
        : (pseo.skills?.[where.skill] ?? pseo.cities?.[where.city] ?? pseo.levels?.[where.level] ?? 0)
      return { _count: { _all: n }, _max: { updatedAt: n > 0 ? ROLE_LATEST : null } }
    }
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
    groupBy.mockReset()
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

describe('collectEvergreenEntries: pSEO unlock (phase 1)', () => {
  beforeEach(() => {
    __resetEvergreenSitemapCacheForTests()
    aggregate.mockReset()
    groupBy.mockReset()
    process.env.INDEXING_PHASE = '1'
    delete process.env.SEO_INDEXATION_PHASE
    delete process.env.PSEO_UNLOCK
    delete process.env.PSEO_HUB_MIN_JOBS
    delete process.env.PSEO_ROLE_MIN_JOBS
  })

  it('lists skill, city and level hubs only from the hub threshold (25)', async () => {
    mockDb({}, {
      skills: { python: 279, rust: 24, kubernetes: 25 },
      cities: { 'new-york': 135, seattle: 24 },
      levels: { senior: 708, entry: 4 },
    })
    const p = paths(await collectEvergreenEntries(1))
    expect(p).toEqual(expect.arrayContaining(['/jobs/skills/python', '/jobs/skills/kubernetes', '/jobs/city/new-york', '/jobs/level/senior']))
    expect(p).not.toContain('/jobs/skills/rust')
    expect(p).not.toContain('/jobs/city/seattle')
    expect(p).not.toContain('/jobs/level/entry')
  })

  it('lists tier-1 roles outside the phase 1 list from 10 jobs, counting roleSlug equal or containing', async () => {
    mockDb({}, {
      roleGroups: [
        { roleSlug: 'senior-software-engineer', count: 8 },
        { roleSlug: 'senior-software-engineer-ii', count: 4 }, // contains the role: counted too (12)
        { roleSlug: 'staff-software-engineer', count: 9 },
        { roleSlug: null, count: 500 },
      ],
    })
    const p = paths(await collectEvergreenEntries(1))
    expect(p).toContain('/jobs/senior-software-engineer')
    expect(p).not.toContain('/jobs/staff-software-engineer')
  })

  it('lists role x skill and role x city combos only from 10 jobs and only for unlocked skills / cities', async () => {
    mockDb({}, {
      skills: { python: 279, rust: 3 },
      cities: { 'new-york': 135 },
      combos: {
        'software-engineer/python': 13,
        'software-engineer/rust': 50, // rust hub is not unlocked, so its combos are never checked
        'backend-engineer/python': 9, // indexable (>= 5) but below the sitemap bar
        'software-engineer/new-york': 10,
        'data-engineer/new-york': 5,
      },
    })
    const p = paths(await collectEvergreenEntries(1))
    expect(p).toContain('/jobs/software-engineer/skills/python')
    expect(p).toContain('/jobs/software-engineer/city/new-york')
    expect(p).not.toContain('/jobs/backend-engineer/skills/python')
    expect(p).not.toContain('/jobs/software-engineer/skills/rust')
    expect(p).not.toContain('/jobs/data-engineer/city/new-york')
  })

  it('adds nothing when PSEO_UNLOCK=0', async () => {
    process.env.PSEO_UNLOCK = '0'
    mockDb({}, { skills: { python: 279 }, cities: { 'new-york': 135 }, levels: { senior: 708 } })
    const p = paths(await collectEvergreenEntries(1))
    expect(p.some((x) => x.startsWith('/jobs/skills/') || x.startsWith('/jobs/city/') || x.startsWith('/jobs/level/'))).toBe(false)
  })

  it('leaves the hubs to their own sitemap families in phase 2', async () => {
    process.env.INDEXING_PHASE = '2'
    mockDb({}, { skills: { python: 279 }, cities: { 'new-york': 135 }, levels: { senior: 708 } })
    const p = paths(await collectEvergreenEntries(1))
    expect(p).not.toContain('/jobs/skills/python')
    expect(p).not.toContain('/jobs/city/new-york')
    expect(p).not.toContain('/jobs/level/senior')
  })
})
