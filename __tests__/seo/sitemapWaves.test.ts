// Staged sitemap rollout (lib/seo/sitemapWaves.ts). jest.setup.js sets SITEMAP_WAVE=8 for the other tests; here each
// test sets the wave itself, and the production default (unset = wave 1) is covered too.
const originalSiteUrl = process.env.SITE_URL
const originalWave = process.env.SITEMAP_WAVE
let getHubs: typeof import('../../app/sitemap-hubs.xml/route').GET
let getIndex: typeof import('../../app/sitemap.xml/route').GET
let clearMemo: () => void

beforeAll(async () => {
  process.env.SITE_URL = 'https://www.sixfigurejobs.net'
  jest.resetModules()
  ;({ GET: getHubs } = await import('../../app/sitemap-hubs.xml/route'))
  ;({ GET: getIndex } = await import('../../app/sitemap.xml/route'))
  ;({ __clearMemoForTests: clearMemo } = await import('../../lib/cache/memo'))
})

afterAll(() => {
  if (originalSiteUrl === undefined) delete process.env.SITE_URL
  else process.env.SITE_URL = originalSiteUrl
  if (originalWave === undefined) delete process.env.SITEMAP_WAVE
  else process.env.SITEMAP_WAVE = originalWave
})

const aggregate = jest.fn()
jest.mock('../../lib/prisma', () => ({ prisma: { job: { aggregate: (...a: unknown[]) => aggregate(...a) } } }))

import {
  areCompanyPagesReleased,
  getHubPathWave,
  getPseoBatchCapForWave,
  getSitemapWave,
  isHubPathInWave,
} from '../../lib/seo/sitemapWaves'
import { getReleasedPseoBatch, isPseoBatchReleased } from '../../lib/seo/pseoBatches'
import { shouldAdvertiseSitemapFamily } from '../../lib/seo/sitemapPolicy'
import { isPseoHubUnlocked, isPseoRoleUnlocked } from '../../lib/seo/pseoUnlock'
import { isPhaseIndexable, __resetIndexingPhaseCacheForTests } from '../../lib/seo/indexingPhase'

const WAVE_1 = [
  '/',
  '/jobs',
  '/remote',
  '/companies',
  '/salary',
  '/high-paying-jobs',
  '/high-paying-jobs-report',
  '/blog',
  '/privacy',
  '/terms',
  '/about',
  '/post-a-job',
]

const locsOf = (xml: string) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace('https://www.sixfigurejobs.net', '') || '/')

describe('sitemap waves', () => {
  beforeEach(() => {
    delete process.env.SITEMAP_WAVE
    delete process.env.PSEO_RELEASED_BATCH
    delete process.env.PSEO_BATCH_SCHEDULE
    process.env.INDEXING_PHASE = '1'
    __resetIndexingPhaseCacheForTests()
    aggregate.mockReset()
    clearMemo()
  })

  it('starts at wave 1 when SITEMAP_WAVE is unset, and clamps bad values', () => {
    expect(getSitemapWave()).toBe(1)
    process.env.SITEMAP_WAVE = '0'
    expect(getSitemapWave()).toBe(1)
    process.env.SITEMAP_WAVE = 'abc'
    expect(getSitemapWave()).toBe(1)
    process.env.SITEMAP_WAVE = '99'
    expect(getSitemapWave()).toBe(8)
  })

  it.each(WAVE_1)('%s is in wave 1', (path) => {
    expect(getHubPathWave(path)).toBe(1)
  })

  it.each([
    ['/blog/how-to-negotiate-salary-100k', 2],
    ['/jobs/software-engineer', 3],
    ['/salary/software-engineer', 4],
    ['/remote/software-engineer', 4],
    ['/remote/companies', 4],
    ['/jobs/no-degree', 4],
    ['/jobs/4-day-week', 4],
    ['/high-paying-jobs-report/method', 4],
  ])('%s waits for wave %i', (path, wave) => {
    expect(getHubPathWave(path)).toBe(wave)
    expect(isHubPathInWave(path, wave - 1)).toBe(false)
    expect(isHubPathInWave(path, wave)).toBe(true)
  })

  it('submits salary bands from wave 2, countries from 3 and companies from 5', () => {
    const at = (wave: number) => {
      process.env.SITEMAP_WAVE = String(wave)
      return ['salary', 'country', 'company'].filter((f) => shouldAdvertiseSitemapFamily(f as 'salary'))
    }
    expect(at(1)).toEqual([])
    expect(at(2)).toEqual(['salary'])
    expect(at(3)).toEqual(['salary', 'country'])
    expect(at(4)).toEqual(['salary', 'country'])
    expect(at(5)).toEqual(['salary', 'country', 'company'])
  })

  it('releases no pSEO batch before wave 5, then batch n - 4, never past PSEO_RELEASED_BATCH', () => {
    process.env.PSEO_RELEASED_BATCH = '2'
    for (const [wave, batch] of [[1, 0], [4, 0], [5, 1], [6, 2], [8, 2]]) {
      process.env.SITEMAP_WAVE = String(wave)
      expect(getPseoBatchCapForWave()).toBe(Math.max(0, wave - 4))
      expect(getReleasedPseoBatch()).toBe(batch)
    }
    process.env.SITEMAP_WAVE = '1'
    // Unreleased batch pages serve noindex, follow (lib/seo/pseoUnlock.ts). The salary bands, /jobs/no-degree and
    // /jobs/4-day-week have their own routes and never consult the batch; Phase 1 role pages pass isPhaseIndexable first.
    expect(isPseoBatchReleased('/jobs/skills/python')).toBe(false)
    expect(isPseoBatchReleased('/jobs/city/london')).toBe(false)
    expect(isPseoBatchReleased('/jobs/senior-software-engineer')).toBe(false)
    expect(isPseoHubUnlocked(500, '/jobs/skills/python')).toBe(false)
    expect(isPseoRoleUnlocked(500, '/jobs/senior-software-engineer')).toBe(false)
    expect(isPhaseIndexable({ roleSlug: 'software-engineer', pathname: '/jobs/software-engineer' })).toBe(true)
  })

  it('releases company pages from wave 5', () => {
    expect(areCompanyPagesReleased(4)).toBe(false)
    expect(areCompanyPagesReleased(5)).toBe(true)
  })

  it('wave 1: the index lists only the hubs file, and the hubs file only wave 1 pages', async () => {
    aggregate.mockResolvedValue({ _count: { _all: 50 }, _max: { createdAt: new Date('2026-11-20T00:00:00Z') } })
    const index = await (await getIndex()).text()
    expect(locsOf(index)).toEqual(['/sitemap-hubs.xml'])

    const hubs = locsOf(await (await getHubs()).text())
    expect(hubs.length).toBeGreaterThan(0)
    expect(hubs.every((p) => WAVE_1.includes(p))).toBe(true)
    for (const p of ['/', '/jobs', '/remote', '/companies', '/salary', '/high-paying-jobs-report', '/blog', '/about', '/privacy', '/terms', '/post-a-job']) {
      expect(hubs).toContain(p)
    }
  })

  it('wave 4: the role hubs, salary guides and blog articles join the hubs file', async () => {
    process.env.SITEMAP_WAVE = '4'
    aggregate.mockResolvedValue({ _count: { _all: 50 }, _max: { createdAt: new Date('2026-11-20T00:00:00Z') } })
    const hubs = locsOf(await (await getHubs()).text())
    expect(hubs).toContain('/jobs/software-engineer')
    expect(hubs).toContain('/salary/software-engineer')
    expect(hubs.some((p) => p.startsWith('/blog/'))).toBe(true)
  })
})
