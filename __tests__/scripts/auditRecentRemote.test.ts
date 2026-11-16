import { compareWithDescription, fieldProblems, storedMode } from '../../scripts/auditRecentRemote'

const job = (over: Record<string, unknown> = {}) => ({
  id: 'j1', source: 'ats:greenhouse', title: 'Engineer', locationRaw: 'Austin, TX', city: 'Austin', countryCode: 'US',
  remote: false, remoteMode: 'onsite', remoteRegion: null, descriptionHtml: null, ...over,
}) as Parameters<typeof fieldProblems>[0]

describe('storedMode', () => {
  it('reads remoteMode first, then the remote flag', () => {
    expect(storedMode({ remote: false, remoteMode: 'hybrid' })).toBe('hybrid')
    expect(storedMode({ remote: true, remoteMode: null })).toBe('remote')
    expect(storedMode({ remote: false, remoteMode: null })).toBe('unstated')
    expect(storedMode({ remote: null, remoteMode: null })).toBe('unstated')
  })
})

describe('fieldProblems', () => {
  it('finds nothing wrong in a consistent on-site job', () => {
    expect(fieldProblems(job())).toEqual([])
  })

  it('flags a remote flag that contradicts the stored mode', () => {
    expect(fieldProblems(job({ remote: true, remoteMode: 'onsite' }))).toContain('flag-remote-but-mode-onsite')
    expect(fieldProblems(job({ remote: false, remoteMode: 'remote', locationRaw: 'Remote' }))).toContain('mode-remote-but-flag-not-set')
  })

  it('flags location text that says remote or hybrid while the job is stored as something else', () => {
    expect(fieldProblems(job({ locationRaw: 'Remote - United States' }))).toContain('location-says-remote-but-not-stored-remote')
    expect(fieldProblems(job({ locationRaw: 'Hybrid - London, UK', countryCode: 'GB' }))).toContain('location-says-hybrid-but-not-stored-hybrid')
    expect(fieldProblems(job({ locationRaw: 'Hybrid - London, UK', countryCode: 'GB', remoteMode: 'hybrid' }))).not.toContain('location-says-hybrid-but-not-stored-hybrid')
  })

  it('flags a remote job with no country and no region unless its location text says worldwide', () => {
    expect(fieldProblems(job({ remote: true, remoteMode: 'remote', locationRaw: 'Remote', countryCode: null }))).toContain('remote-with-no-country-or-region')
    expect(fieldProblems(job({ remote: true, remoteMode: 'remote', locationRaw: 'Remote - Worldwide', countryCode: null }))).not.toContain('remote-with-no-country-or-region')
    expect(fieldProblems(job({ remote: true, remoteMode: 'remote', locationRaw: 'Remote', countryCode: null, remoteRegion: 'Global' }))).not.toContain('remote-with-no-country-or-region')
  })

  it('flags a country that differs from the one the location text names', () => {
    expect(fieldProblems(job({ locationRaw: 'London, United Kingdom', countryCode: 'US' }))).toContain('country-differs-from-location-text')
  })
})

describe('compareWithDescription', () => {
  it('says nothing when there is no description', () => {
    expect(compareWithDescription(job()).head).toBe('none')
  })
})
