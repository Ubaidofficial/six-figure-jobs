import { buildWikidataQuery, parseWikidataBindings, siteKey, websiteVariants } from '../../lib/companies/wikidataProfile'

describe('wikidataProfile', () => {
  it('reduces a website to a host key', () => {
    expect(siteKey('https://www.Harness.io/careers')).toBe('harness.io')
    expect(siteKey('mattermost.com')).toBe('mattermost.com')
    expect(siteKey('::::')).toBeNull()
  })

  it('lists the spellings of an official-website claim', () => {
    expect(websiteVariants('ea.com')).toEqual(expect.arrayContaining(['https://ea.com/', 'https://www.ea.com/', 'http://ea.com', 'https://www.ea.com']))
    expect(websiteVariants('ea.com')).toHaveLength(8)
  })

  it('builds one query for many hosts and drops anything that is not a plain host', () => {
    const q = buildWikidataQuery(['harness.io', 'a> } DROP', 'ea.com'])
    expect(q).toContain('<https://harness.io/>')
    expect(q).toContain('<http://www.ea.com>')
    expect(q).not.toContain('DROP')
    expect(q).toContain('wdt:P856')
  })

  it('keeps the earliest founding year and the largest headcount per host, and ignores junk', () => {
    const map = parseWikidataBindings([
      { site: { value: 'https://mattermost.com/' }, inception: { value: '2015-10-02T00:00:00Z' } },
      { site: { value: 'https://mattermost.com/' } },
      { site: { value: 'https://www.acme.com/' }, inception: { value: '2010-01-01T00:00:00Z' }, employees: { value: '120' } },
      { site: { value: 'https://acme.com' }, inception: { value: '1999-05-05T00:00:00Z' }, employees: { value: '300' } },
      { site: { value: 'https://old.com/' }, inception: { value: '1066-01-01T00:00:00Z' } },
      { inception: { value: '2000-01-01T00:00:00Z' } },
    ])
    expect(map.get('mattermost.com')).toEqual({ foundingYear: 2015 })
    expect(map.get('acme.com')).toEqual({ foundingYear: 1999, employees: 300 })
    expect(map.get('old.com')).toEqual({})
    expect(map.size).toBe(3)
  })
})
