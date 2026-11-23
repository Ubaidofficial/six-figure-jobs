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

  it('gives the company its own element, and leaves it out when unknown', () => {
    expect(xml).toContain('<company><![CDATA[Acme & Co]]></company>')
    const unknown = buildJobsRss([job({ company: '', companyRef: null })], { siteUrl: 'https://x.test', title: 't', description: 'd', selfPath: '/f' })
    expect(unknown).not.toContain('<company>')
    expect(unknown).toContain('<title>A hiring company: ')
  })

  it('keeps the short description unless full descriptions are asked for', () => {
    expect(xml).not.toContain('CDATA[<p>')
  })

  describe('with full descriptions', () => {
    const full = (descriptionHtml: string | null) =>
      buildJobsRss([job({ descriptionHtml })], { siteUrl: 'https://x.test', title: 't', description: 'd', selfPath: '/f', fullDescriptions: true })
    const bodyOf = (feed: string) => feed.match(/<item>[\s\S]*<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? ''

    it('puts the facts first, then the description as escaped paragraphs', () => {
      const body = bodyOf(
        full('<p>We build payments infrastructure for thousands of businesses around the world, every day.</p><ul><li>Own the ledger &amp; the APIs</li></ul><script>alert(1)</script>'),
      )
      expect(body).toMatch(/^<p>\$180.*Hybrid<\/p>/)
      expect(body).toContain('<p>We build payments infrastructure for thousands of businesses around the world, every day.</p>')
      expect(body).toContain('<p>- Own the ledger &amp; the APIs</p>')
      expect(body).not.toContain('script')
      expect(body).not.toContain('alert')
    })

    it('escapes markup in the text so none reaches a reader', () => {
      const body = bodyOf(full('<p>Work with &lt;img src=x onerror=alert(1)&gt; tags across a large distributed team of engineers.</p>'))
      expect(body).not.toContain('<img')
      expect(body).toContain('&lt;img')
    })

    it('keeps just the facts when there is no description', () => {
      expect(bodyOf(full(null))).toMatch(/^<p>\$180[^<]*<\/p>$/)
    })
  })

  it('escapes all five XML characters', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })
})
