import {
  ALWAYS_INDEXABLE_HUBS,
  PHASE_1_COUNTRY_CODES,
  PHASE_1_ENABLED_SITEMAP_FAMILIES,
  PHASE_1_ROLE_SLUGS,
  __resetIndexingPhaseCacheForTests,
  buildPhase1SilencedSitemapResponse,
  getIndexingPhase,
  isPhase1,
  isPhase2OrLater,
  isPhaseIndexable,
  isSitemapFamilyEnabled,
} from '../../lib/seo/indexingPhase'

const originalEnv = process.env.INDEXING_PHASE

function setPhase(value: string | undefined) {
  if (value === undefined) {
    delete process.env.INDEXING_PHASE
  } else {
    process.env.INDEXING_PHASE = value
  }
  __resetIndexingPhaseCacheForTests()
}

afterEach(() => {
  setPhase(originalEnv)
})

describe('getIndexingPhase', () => {
  it('defaults to phase 1 when INDEXING_PHASE is unset or invalid', () => {
    setPhase(undefined)
    expect(getIndexingPhase()).toBe(1)
    setPhase('garbage')
    expect(getIndexingPhase()).toBe(1)
  })

  it('reads phase 2 and 3 from env', () => {
    setPhase('2')
    expect(getIndexingPhase()).toBe(2)
    setPhase('3')
    expect(getIndexingPhase()).toBe(3)
  })
})

describe('isSitemapFamilyEnabled', () => {
  it('allows only the enabled families in phase 1', () => {
    setPhase('1')
    for (const family of PHASE_1_ENABLED_SITEMAP_FAMILIES) {
      expect(isSitemapFamilyEnabled(family)).toBe(true)
    }
    expect(isSitemapFamilyEnabled('sitemap-city')).toBe(false)
    expect(isSitemapFamilyEnabled('sitemap-skills')).toBe(false)
  })

  it('allows everything in phase 2', () => {
    setPhase('2')
    expect(isSitemapFamilyEnabled('sitemap-city')).toBe(true)
    expect(isSitemapFamilyEnabled('sitemap-skills')).toBe(true)
    expect(isSitemapFamilyEnabled('something-arbitrary')).toBe(true)
  })
})

describe('isPhaseIndexable', () => {
  it('always allows pillar hubs', () => {
    setPhase('1')
    for (const hub of ALWAYS_INDEXABLE_HUBS) {
      expect(isPhaseIndexable({ pathname: hub })).toBe(true)
    }
  })

  it('allows top role salary guides without country', () => {
    setPhase('1')
    for (const role of PHASE_1_ROLE_SLUGS) {
      expect(isPhaseIndexable({ roleSlug: role })).toBe(true)
    }
    expect(isPhaseIndexable({ roleSlug: 'rust-engineer' })).toBe(false)
  })

  it('allows role × country only when both are allowlisted', () => {
    setPhase('1')
    expect(isPhaseIndexable({ roleSlug: 'software-engineer', countryCode: 'US' })).toBe(true)
    expect(isPhaseIndexable({ roleSlug: 'software-engineer', countryCode: 'JP' })).toBe(false)
    expect(isPhaseIndexable({ roleSlug: 'rust-engineer', countryCode: 'US' })).toBe(false)
  })

  it('allows everything in phase 2+', () => {
    setPhase('2')
    expect(isPhaseIndexable({ roleSlug: 'anything', countryCode: 'JP' })).toBe(true)
    expect(isPhaseIndexable({ pathname: '/some/random/page' })).toBe(true)
  })
})

describe('phase 1 allowlists are non-empty', () => {
  it('role allowlist has at least 5 entries', () => {
    expect(PHASE_1_ROLE_SLUGS.size).toBeGreaterThanOrEqual(5)
  })
  it('country allowlist covers the major tech markets', () => {
    for (const cc of ['US', 'GB', 'CA', 'DE', 'AU']) {
      expect(PHASE_1_COUNTRY_CODES.has(cc)).toBe(true)
    }
  })
  it('hub set includes the homepage', () => {
    expect(ALWAYS_INDEXABLE_HUBS.has('/')).toBe(true)
  })
})

describe('buildPhase1SilencedSitemapResponse', () => {
  it('returns 200 OK with an empty urlset and phase headers', async () => {
    setPhase('1')
    const res = buildPhase1SilencedSitemapResponse('sitemap-city')
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Indexing-Phase')).toBe('1')
    expect(res.headers.get('X-Indexing-Phase-Silenced')).toBe('1')
    const body = await res.text()
    expect(body).toContain('<urlset')
    expect(body).toContain('sitemap-city silenced')
    expect(body).not.toContain('<url>')
  })
})

describe('isPhase1 / isPhase2OrLater convenience helpers', () => {
  it('reflects the current phase', () => {
    setPhase('1')
    expect(isPhase1()).toBe(true)
    expect(isPhase2OrLater()).toBe(false)
    setPhase('2')
    expect(isPhase1()).toBe(false)
    expect(isPhase2OrLater()).toBe(true)
  })
})
