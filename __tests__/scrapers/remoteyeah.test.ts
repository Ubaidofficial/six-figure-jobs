jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { boardBelongsTo, parseCompanyPage, parseCompanyUrls, pickDailyBatch } from '../../lib/scrapers/remoteyeah'

// Shapes seen live on 2026-11-16 (company page for SerpApi, trimmed).
const companyPage = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"RemoteYeah","url":"https://remoteyeah.com"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
 {"@type":"ListItem","position":1,"name":"Homepage","item":"https://remoteyeah.com"},
 {"@type":"ListItem","position":2,"name":"Remote companies","item":"https://remoteyeah.com/remote-companies"},
 {"@type":"ListItem","position":3,"name":"SerpApi","item":"https://remoteyeah.com/remote-companies/serpapi"}]}</script>
</head><body>
<a href="https://x.com/remoteyeah">X</a>
<a href="https://serpapi.com/?utm_source=remoteyeah.com&amp;ref=remoteyeah.com">Website</a>
</body></html>`

describe('parseCompanyUrls', () => {
  const xml = `<sitemapindex>
    <loc>https://remoteyeah.com/remote-companies</loc>
    <loc>https://remoteyeah.com/remote-junior-companies</loc>
    <loc>https://remoteyeah.com/remote-companies/serpapi</loc>
    <loc>https://remoteyeah.com/remote-companies/career-karma</loc>
    <loc>https://remoteyeah.com/remote-companies/serpapi</loc>
    <loc>https://evil.example/remote-companies/x</loc>
    <loc>https://remoteyeah.com/remote-companies/a/b</loc>
  </sitemapindex>`

  it('keeps company pages only, once each', () => {
    expect(parseCompanyUrls(xml)).toEqual([
      'https://remoteyeah.com/remote-companies/serpapi',
      'https://remoteyeah.com/remote-companies/career-karma',
    ])
  })

  it('survives empty input', () => {
    expect(parseCompanyUrls('')).toEqual([])
  })
})

describe('parseCompanyPage', () => {
  it("reads the company name from the breadcrumb and its own site from the tagged link, without the tracking", () => {
    expect(parseCompanyPage(companyPage)).toEqual({ name: 'SerpApi', website: 'https://serpapi.com' })
  })

  it('falls back to the h1 for the name', () => {
    const html = `<h1> Acme  Corp </h1><a href="https://acme.example/?ref=remoteyeah.com">site</a>`
    expect(parseCompanyPage(html)).toEqual({ name: 'Acme Corp', website: 'https://acme.example' })
  })

  it('returns null without the tagged link, so a RemoteYeah or social link is never taken as the website', () => {
    expect(parseCompanyPage(`<h1>Acme</h1><a href="https://x.com/remoteyeah">x</a><a href="https://remoteyeah.com/about">about</a>`)).toBeNull()
  })

  it('returns null when the tagged link is a job-board or ATS address, not an employer site', () => {
    expect(parseCompanyPage(`<h1>Acme</h1><a href="https://boards.greenhouse.io/acme?utm_source=remoteyeah.com">jobs</a>`)).toBeNull()
  })

  it('survives a broken page', () => {
    expect(parseCompanyPage('')).toBeNull()
    expect(parseCompanyPage('<script type="application/ld+json">{oops</script>')).toBeNull()
  })
})

describe('boardBelongsTo', () => {
  it("rejects another company's board linked from the site (seen live: serpapi.com linked Blue Bottle Coffee's Lever board)", () => {
    expect(boardBelongsTo('https://jobs.lever.co/bluebottlecoffee', 'SerpApi', 'https://serpapi.com')).toBe(false)
  })

  it("accepts a board named like the company or like its website", () => {
    expect(boardBelongsTo('https://jobs.lever.co/serpapi', 'SerpApi', 'https://serpapi.com')).toBe(true)
    expect(boardBelongsTo('https://boards.greenhouse.io/acme-labs', 'Acme Labs Inc', 'https://acme.example')).toBe(true)
    expect(boardBelongsTo('https://job-boards.greenhouse.io/acmelabs', 'Acme Labs Inc', 'https://acme.example')).toBe(true)
    expect(boardBelongsTo('https://jobs.ashbyhq.com/life360', 'Some Name', 'https://www.life360.com')).toBe(true)
  })

  it('matches host-based boards on the subdomain', () => {
    expect(boardBelongsTo('https://acme.recruitee.com', 'Acme', 'https://acme.example')).toBe(true)
    expect(boardBelongsTo('https://other.recruitee.com', 'Acme', 'https://acme.example')).toBe(false)
  })

  it('does not match on generic path words or very short names', () => {
    expect(boardBelongsTo('https://jobs.lever.co/jobs', 'Jobs', 'https://jobs.example')).toBe(false)
    expect(boardBelongsTo('https://jobs.lever.co/ab', 'Ab', 'https://ab.example')).toBe(false)
  })

  it('survives bad input', () => {
    expect(boardBelongsTo('', 'Acme', 'https://acme.example')).toBe(false)
    expect(boardBelongsTo('https://jobs.lever.co/acme', 'Acme', 'nope')).toBe(false)
  })
})

describe('pickDailyBatch', () => {
  const items = Array.from({ length: 10 }, (_v, i) => i)
  const day = (n: number) => n * 86_400_000

  it('returns everything when the list is no longer than the cap', () => {
    expect(pickDailyBatch(items, 10, day(5))).toEqual(items)
  })

  it('moves on each day and wraps, so the whole list is covered over time', () => {
    expect(pickDailyBatch(items, 4, day(0))).toEqual([0, 1, 2, 3])
    expect(pickDailyBatch(items, 4, day(1))).toEqual([4, 5, 6, 7])
    expect(pickDailyBatch(items, 4, day(2))).toEqual([8, 9, 0, 1])
  })
})
