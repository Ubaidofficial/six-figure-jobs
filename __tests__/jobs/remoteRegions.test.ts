import { buildWhere } from '../../lib/jobs/queryJobs'
import {
  FLOOR_MARKET_COUNTRIES,
  REMOTE_HUB_CHIP_SLUGS,
  REMOTE_REGIONS,
  countRemoteByRegion,
  isWorldwideLocationText,
  normalizeRemoteRegionSlug,
  remoteRegionDef,
  remoteRegionWhere,
  visibleHubRegionSlugs,
} from '../../lib/jobs/remoteRegions'

// where-clauses carry BigInt salary thresholds, which JSON.stringify cannot print
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))

const countries = (slug: string) => new Set(remoteRegionDef(slug)!.countries ?? [])

describe('remote regions', () => {
  it('has unique slugs, and every hub chip is a defined region', () => {
    const slugs = REMOTE_REGIONS.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of REMOTE_HUB_CHIP_SLUGS) expect(remoteRegionDef(slug)).not.toBeNull()
  })

  it('keeps Europe and the Middle East apart, and offers Canada and Australia like the US', () => {
    expect(REMOTE_HUB_CHIP_SLUGS).toEqual(expect.arrayContaining(['us-only', 'canada', 'australia', 'europe', 'middle-east']))
    expect(REMOTE_HUB_CHIP_SLUGS).not.toContain('emea') // the combined region is not a chip any more
    for (const code of countries('middle-east')) expect(countries('europe').has(code)).toBe(false)
    expect(countries('europe').has('DE')).toBe(true)
    expect(countries('europe').has('GB')).toBe(true)
    expect(countries('middle-east').has('AE')).toBe(true)
    expect(countries('middle-east').has('IL')).toBe(true)
    expect(countries('canada')).toEqual(new Set(['CA']))
    expect(countries('australia')).toEqual(new Set(['AU']))
    expect(countries('us-only')).toEqual(new Set(['US']))
  })

  it('still understands the old combined EMEA slug (links and dropdowns) as Europe + Middle East + Africa', () => {
    for (const code of ['DE', 'GB', 'AE', 'ZA']) expect(countries('emea').has(code)).toBe(true)
    expect(countries('emea').has('US')).toBe(false)
  })

  it('reads slugs from URLs, case-insensitively, and rejects unknown ones', () => {
    expect(normalizeRemoteRegionSlug('Middle-East')).toBe('middle-east')
    expect(normalizeRemoteRegionSlug(['canada', 'x'])).toBe('canada')
    expect(normalizeRemoteRegionSlug('mars')).toBeNull()
    expect(normalizeRemoteRegionSlug(undefined)).toBeNull()
  })

  it('counts remote jobs per region from per-country counts', () => {
    const out = countRemoteByRegion(
      [
        { code: 'US', count: 274 },
        { code: 'CA', count: 70 },
        { code: 'GB', count: 26 },
        { code: 'DE', count: 3 },
        { code: 'AU', count: 2 },
        { code: 'AE', count: 4 },
      ],
      196,
    )
    expect(out['us-only']).toBe(274)
    expect(out.canada).toBe(70)
    expect(out.australia).toBe(2)
    expect(out.europe).toBe(29) // GB + DE
    expect(out['uk-ireland']).toBe(26)
    expect(out['middle-east']).toBe(4)
    expect(out.apac).toBe(2) // AU
    expect(out.global).toBe(196) // the worldwide count, passed in
    expect(out.emea).toBe(33) // GB + DE + AE
  })

  it('uses its own country sets for the homepage markets (Europe there excludes the UK, which has its own row)', () => {
    expect(FLOOR_MARKET_COUNTRIES.GBP).toEqual(['GB'])
    expect(FLOOR_MARKET_COUNTRIES.EUR).not.toContain('GB')
    expect(FLOOR_MARKET_COUNTRIES.EUR).toContain('DE')
    expect(FLOOR_MARKET_COUNTRIES.USD).toEqual(['US'])
  })
})

describe('the region filter', () => {
  it('matches remote jobs by country (and by a stored region slug), not by comparing the stored column to the slug', () => {
    const where = remoteRegionWhere('canada') as any
    const [remote, either] = where.AND
    expect(remote).toEqual({ OR: [{ remote: true }, { remoteMode: 'remote' }] })
    expect(either.OR).toContainEqual({ countryCode: { in: ['CA'] } })
    expect(either.OR).toContainEqual({ remoteRegion: { equals: 'canada', mode: 'insensitive' } })
    expect(json(where)).not.toContain('"remoteRegion":"canada"')
  })

  it('Anywhere in the world: remote, no country, and text that says so', () => {
    const where = json(remoteRegionWhere('global'))
    expect(where).toContain('"countryCode":null')
    expect(where).toContain('"contains":"worldwide"')
    expect(where).toContain('"NOT"')
    expect(remoteRegionDef('global')!.label).toBe('Anywhere in the world')
  })

  it('reads "worldwide", "anywhere" and "global" as worldwide only when nothing limits them', () => {
    for (const t of ['Remote - Worldwide', 'Anywhere', 'Remote (Global)', 'Work from anywhere', 'Worldwide; Remote']) {
      expect(isWorldwideLocationText(t)).toBe(true)
    }
    // Seen live on 2026-11-09 under the old rule (remote + no country), none of them worldwide:
    for (const t of [
      'Remote (US)',
      'San Francisco Bay Area or Remote (U.S.)',
      'New York City',
      'Remote',
      'Anywhere in the US',
      'US - Anywhere',
      'Global (EMEA)',
      'Remote - anywhere in North America',
      'Remote, anywhere, EST hours',
      null,
    ]) {
      expect(isWorldwideLocationText(t)).toBe(false)
    }
  })

  it('an unknown slug keeps the old exact match', () => {
    expect(remoteRegionWhere('mars')).toEqual({ remoteRegion: 'mars' })
  })

  it('is part of buildWhere when a region is asked for, and absent otherwise', () => {
    const withRegion = json(buildWhere({ remoteRegion: 'australia' }))
    expect(withRegion).toContain('"countryCode":{"in":["AU"]}')
    expect(json(buildWhere({}))).not.toContain('"in":["AU"]')
  })
})

describe('hub chips', () => {
  const counts = { global: 291, 'us-only': 537, canada: 90, australia: 2, europe: 48, 'middle-east': 0, apac: 5 }

  it('leaves out a region with no remote jobs (never a chip that opens an empty page)', () => {
    const shown = visibleHubRegionSlugs(counts, null)
    expect(shown).not.toContain('middle-east')
    expect(shown).toEqual(['global', 'us-only', 'canada', 'australia', 'europe', 'apac'])
  })

  it('keeps the region being viewed even when it is empty, so the page does not lose its own chip', () => {
    expect(visibleHubRegionSlugs(counts, 'middle-east')).toContain('middle-east')
  })

  it('shows every region when the counts are not available', () => {
    expect(visibleHubRegionSlugs(null, null)).toEqual([...REMOTE_HUB_CHIP_SLUGS])
    expect(visibleHubRegionSlugs(undefined, null)).toEqual([...REMOTE_HUB_CHIP_SLUGS])
  })

  it('treats a missing count as none', () => {
    expect(visibleHubRegionSlugs({ 'us-only': 3 }, null)).toEqual(['us-only'])
  })
})
