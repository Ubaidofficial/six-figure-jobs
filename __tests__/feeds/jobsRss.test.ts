import { buildJobsRss, escapeXml } from '../../lib/feeds/jobsRss'

const job = (over: Record<string, unknown>) =>
  ({
    id: 'board:test:1',
    shortId: 'abc123',
    title: 'Senior Engineer <Payments>',
    company: 'Acme & Co',
    companyRef: { name: 'Acme & Co' },
    currency: 'USD',
    minAnnual: BigInt(180_000),
    maxAnnual: BigInt(220_000),
    salaryPeriod: 'year',
    countryCode: 'US',
    locationRaw: 'New York, NY',
    remoteMode: 'hybrid',
    postedAt: new Date('2026-11-07T10:00:00Z'),
    ...over,
  }) as never

describe('buildJobsRss', () => {
  const xml = buildJobsRss([job({})], {
    siteUrl: 'https://www.6figjobs.com',
    title: 'Six Figure Jobs: newest $100k+ jobs',
    description: 'desc',
    selfPath: '/feeds/jobs.rss',
  })

  it('is RSS 2.0 with a self link and one item per job', () => {
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<atom:link href="https://www.6figjobs.com/feeds/jobs.rss" rel="self"')
    expect(xml.match(/<item>/g)).toHaveLength(1)
  })

  it('titles items "Company: Job", escapes XML and links to the job page on this site', () => {
    expect(xml).toContain('<title>Acme &amp; Co: Senior Engineer &lt;Payments&gt;</title>')
    expect(xml).toMatch(/<link>https:\/\/www\.6figjobs\.com\/job\/[a-z0-9-]+<\/link>/)
    expect(xml).toContain('<pubDate>Sat, 07 Nov 2026 10:00:00 GMT</pubDate>')
  })

  it('describes pay, place and work arrangement', () => {
    const desc = xml.match(/<description>([^<]*)<\/description>/g)?.[1] ?? ''
    expect(desc).toMatch(/\$180/)
    expect(desc).toContain('Hybrid')
  })

  it('escapes all five XML characters', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })
})
