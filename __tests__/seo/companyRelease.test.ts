import { __clearMemoForTests } from '../../lib/cache/memo'
import { buildCompanyPublishingManifestData } from '../../lib/seo/companyPublishing'
import { getCompanyReleaseLimit } from '../../lib/seo/sitemapWaves'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: { findMany: jest.fn() },
    company: { findMany: jest.fn() },
    siteConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}))

// Wave 5 would otherwise release every company the drip had unlocked since 2026-06-04 (about 290 on 2026-11-24) at once.
describe('company pages released per sitemap wave', () => {
  it.each([
    [1, Infinity],
    [4, Infinity],
    [5, 25],
    [6, 50],
    [7, 100],
    [8, 200],
  ])('wave %i allows %p', (wave, limit) => {
    expect(getCompanyReleaseLimit(wave, undefined)).toBe(limit)
  })

  it('COMPANY_RELEASE_LIMIT overrides the wave from wave 5, and a typo keeps the wave', () => {
    expect(getCompanyReleaseLimit(5, '10')).toBe(10)
    expect(getCompanyReleaseLimit(8, '0')).toBe(0)
    expect(getCompanyReleaseLimit(5, 'ten')).toBe(25)
    expect(getCompanyReleaseLimit(5, '-3')).toBe(25)
    expect(getCompanyReleaseLimit(4, '10')).toBe(Infinity) // before wave 5 company pages are noindex anyway
  })
})

describe('the manifest unlocks only the capped number of ready companies, best first', () => {
  const COUNT = 30
  const companies = Array.from({ length: COUNT }, (_, i) => ({
    id: `c${i}`,
    slug: `company-${String(i).padStart(2, '0')}`,
    name: `Company ${i}`,
    description: 'A company that builds software. '.repeat(6),
    website: `https://company-${i}.example`,
    logoUrl: null,
    industry: 'Software',
    sizeBucket: '1000+',
    headquarters: null,
    atsUrl: null,
    updatedAt: new Date('2026-11-20T00:00:00Z'),
  }))
  // Company i has 5 + i live jobs, so a higher i scores higher.
  const jobs = companies.flatMap((c, i) =>
    Array.from({ length: 5 + i }, (_, j) => ({
      companyId: c.id,
      roleSlug: j % 2 ? 'software-engineer' : 'data-engineer',
      citySlug: null,
      countryCode: 'US',
      remote: false,
      remoteMode: 'onsite',
      salarySource: 'ats',
      aiSnippet: null,
      aiOneLiner: null,
      descriptionHtml: null,
      updatedAt: new Date('2026-11-20T00:00:00Z'),
    })),
  )
  const now = new Date('2026-11-24T12:00:00Z')
  const wave = process.env.SITEMAP_WAVE

  // The released set kept in SiteConfig between builds: one stored row, empty at the start of each test.
  let stored: string | null = null
  const findUnique = prisma.siteConfig.findUnique as unknown as jest.Mock
  const upsert = prisma.siteConfig.upsert as unknown as jest.Mock

  beforeEach(() => {
    __clearMemoForTests()
    ;(prisma.job.findMany as unknown as jest.Mock).mockReset().mockResolvedValue(jobs)
    ;(prisma.company.findMany as unknown as jest.Mock).mockReset().mockResolvedValue(companies)
    stored = null
    findUnique.mockReset().mockImplementation(async () => (stored === null ? null : { value: stored }))
    upsert.mockReset().mockImplementation(async ({ update }: { update: { value: string } }) => {
      stored = update.value
    })
  })
  afterEach(() => {
    process.env.SITEMAP_WAVE = wave
    delete process.env.COMPANY_RELEASE_LIMIT
  })

  it('at wave 5: 25 of 30 ready companies, the highest-scoring ones, and no time-based next unlock', async () => {
    process.env.SITEMAP_WAVE = '5'
    const m = await buildCompanyPublishingManifestData(now)
    expect(m.readyCount).toBe(COUNT)
    expect(m.unlockedCount).toBe(25)
    const unlocked = m.candidates.filter((c) => c.unlocked).map((c) => c.slug)
    expect(unlocked).toHaveLength(25)
    expect(unlocked).not.toContain('company-00') // the five weakest wait
    expect(unlocked).toContain('company-29')
    expect(m.nextUnlockAt).toBeNull()
  })

  it('COMPANY_RELEASE_LIMIT holds it to fewer', async () => {
    process.env.SITEMAP_WAVE = '5'
    process.env.COMPANY_RELEASE_LIMIT = '3'
    const m = await buildCompanyPublishingManifestData(now)
    expect(m.candidates.filter((c) => c.unlocked).map((c) => c.slug)).toEqual(['company-29', 'company-28', 'company-27'])
  })

  // Owner's decision, 2026-11-25: the employers added for remote100k.com coverage go past the cap once ready.
  describe('the remote100k employers', () => {
    // The two weakest companies become Grafana Labs (by slug) and Tailscale (by exact name, under another slug).
    const withNew = () => {
      const list = companies.map((c) => ({ ...c }))
      list[0] = { ...list[0], slug: 'grafana-labs', name: 'Grafana Labs' }
      list[1] = { ...list[1], slug: 'tailscale-inc', name: 'Tailscale' }
      return list
    }

    it('are unlocked past the cap at wave 5, matched by slug or by name', async () => {
      process.env.SITEMAP_WAVE = '5'
      ;(prisma.company.findMany as unknown as jest.Mock).mockResolvedValue(withNew())
      const m = await buildCompanyPublishingManifestData(now)
      const unlocked = m.candidates.filter((c) => c.unlocked).map((c) => c.slug)
      expect(unlocked).toEqual(expect.arrayContaining(['grafana-labs', 'tailscale-inc', 'company-29']))
      expect(unlocked).toHaveLength(27)
      expect(m.unlockedCount).toBe(27) // the company sitemap pages by this count
    })

    it('stay locked while their page is not ready', async () => {
      process.env.SITEMAP_WAVE = '5'
      const list = withNew()
      list[0] = { ...list[0], website: null } // not ready: missing_website
      ;(prisma.company.findMany as unknown as jest.Mock).mockResolvedValue(list)
      const m = await buildCompanyPublishingManifestData(now)
      const grafana = m.candidates.find((c) => c.slug === 'grafana-labs')
      expect(grafana?.ready).toBe(false)
      expect(grafana?.unlocked).toBe(false)
      expect(m.unlockedCount).toBe(26)
    })

    it('stay locked when COMPANY_RELEASE_LIMIT=0 holds every company back', async () => {
      process.env.SITEMAP_WAVE = '5'
      process.env.COMPANY_RELEASE_LIMIT = '0'
      ;(prisma.company.findMany as unknown as jest.Mock).mockResolvedValue(withNew())
      const m = await buildCompanyPublishingManifestData(now)
      expect(m.unlockedCount).toBe(0)
    })
  })

  // Owner's request, 2026-11-27: the 25th place changed hands with every scrape, so pages went from index to noindex.
  describe('a released company keeps its page', () => {
    const unlockedOf = (m: { candidates: Array<{ slug: string; unlocked: boolean }> }) =>
      m.candidates.filter((c) => c.unlocked).map((c) => c.slug)
    const settle = () => new Promise((resolve) => setImmediate(resolve))
    // company-05 overtakes the five released companies at the bottom of the list (company-05 .. company-09 rank 21-25).
    const boosted = () =>
      jobs.concat(Array.from({ length: 40 }, () => ({ ...jobs.find((j) => j.companyId === 'c0')!, companyId: 'c0' })))

    it('when another company outscores it at the next build', async () => {
      process.env.SITEMAP_WAVE = '5'
      const first = unlockedOf(await buildCompanyPublishingManifestData(now, { persistRelease: true }))
      await settle()
      expect(first).not.toContain('company-00')
      expect(JSON.parse(stored!)).toEqual([...first].sort())

      ;(prisma.job.findMany as unknown as jest.Mock).mockResolvedValue(boosted())
      const m = await buildCompanyPublishingManifestData(now, { persistRelease: true })
      expect(unlockedOf(m).sort()).toEqual([...first].sort())
      expect(m.candidates.find((c) => c.slug === 'company-00')?.unlocked).toBe(false)
      // Released companies rank 1..25, so a rank within the count still means "released".
      expect(m.candidates.filter((c) => c.unlocked).every((c) => (c.rolloutRank ?? Infinity) <= 25)).toBe(true)
    })

    it('until it stops being ready: its place goes to the next best company', async () => {
      process.env.SITEMAP_WAVE = '5'
      const first = unlockedOf(await buildCompanyPublishingManifestData(now, { persistRelease: true }))
      await settle()
      expect(first).toContain('company-29')

      const list = companies.map((c) => (c.slug === 'company-29' ? { ...c, website: null } : c)) // missing_website
      ;(prisma.company.findMany as unknown as jest.Mock).mockResolvedValue(list)
      const m = await buildCompanyPublishingManifestData(now, { persistRelease: true })
      await settle()
      const unlocked = unlockedOf(m)
      expect(unlocked).not.toContain('company-29')
      expect(unlocked).toContain('company-04') // the best of those that waited
      expect(unlocked).toHaveLength(25)
      expect(JSON.parse(stored!)).not.toContain('company-29')
    })

    it('a lower COMPANY_RELEASE_LIMIT still holds it back, keeping the best of the released ones', async () => {
      process.env.SITEMAP_WAVE = '5'
      await buildCompanyPublishingManifestData(now, { persistRelease: true })
      await settle()
      process.env.COMPANY_RELEASE_LIMIT = '3'
      const m = await buildCompanyPublishingManifestData(now, { persistRelease: true })
      expect(unlockedOf(m)).toEqual(['company-29', 'company-28', 'company-27'])
    })

    it('a build without persistRelease (the report script) reads the released set but never writes it', async () => {
      process.env.SITEMAP_WAVE = '5'
      await buildCompanyPublishingManifestData(now)
      await settle()
      expect(upsert).not.toHaveBeenCalled()
    })

    it('rank alone decides when the stored set cannot be read', async () => {
      process.env.SITEMAP_WAVE = '5'
      findUnique.mockRejectedValue(new Error('db down'))
      const m = await buildCompanyPublishingManifestData(now)
      expect(unlockedOf(m)).toHaveLength(25)
      expect(unlockedOf(m)).not.toContain('company-00')
    })
  })

  it('before wave 5 the drip alone decides, as before', async () => {
    process.env.SITEMAP_WAVE = '4'
    const m = await buildCompanyPublishingManifestData(now)
    expect(m.unlockedCount).toBe(COUNT)
  })
})
