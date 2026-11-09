import {
  analyzeGraph,
  checkJobPosting,
  checkPage,
  flattenJsonLd,
  isAllowedByRobots,
  jobSignature,
  normalizeUrl,
  pageKind,
  parsePage,
  parseRobots,
  percentile,
  typesOf,
  type PageContext,
} from '@/lib/seo/crawlChecks'

const ORIGIN = 'https://www.6figjobs.com'
const NOW = new Date('2026-11-09T12:00:00Z')

const posting = (over: Record<string, unknown> = {}) => ({
  '@type': 'JobPosting',
  title: 'Senior Engineer',
  description: '<p>' + 'Build and run the systems that power our product. '.repeat(4) + '</p>',
  datePosted: '2026-11-05T00:00:00Z',
  validThrough: '2026-12-05T00:00:00Z',
  employmentType: 'FULL_TIME',
  hiringOrganization: { '@type': 'Organization', name: 'Acme' },
  jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Austin', addressCountry: 'US' } },
  baseSalary: { '@type': 'MonetaryAmount', currency: 'USD', value: { '@type': 'QuantitativeValue', minValue: 150000, maxValue: 200000, unitText: 'YEAR' } },
  ...over,
})

const page = (opts: { head?: string; body?: string; ld?: unknown[] } = {}) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Senior Engineer at Acme — $150k–$200k/yr | Six Figure Jobs</title>
<meta name="description" content="${'Apply for Senior Engineer at Acme. Compensation: $150k–$200k/yr. Location: Austin, US. '.repeat(1)}">
<link rel="canonical" href="${ORIGIN}/job/senior-engineer-j-abc123">
<meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="i">
<meta name="twitter:card" content="summary">
${(opts.ld ?? [posting(), { '@type': 'BreadcrumbList' }]).map((d) => `<script type="application/ld+json">${JSON.stringify(d)}</script>`).join('')}
${opts.head ?? ''}</head><body><h1>Senior Engineer</h1><h2>About</h2>
<p>${'word '.repeat(200)}</p><a href="/jobs">All jobs</a>${opts.body ?? ''}</body></html>`

const ctx = (over: Partial<PageContext> = {}): PageContext => ({
  url: `${ORIGIN}/job/senior-engineer-j-abc123`,
  origin: ORIGIN,
  status: 200,
  inSitemap: true,
  contentType: 'text/html; charset=utf-8',
  contentEncoding: 'br',
  xRobotsTag: '',
  bytes: 90_000,
  ttfbMs: 300,
  now: NOW,
  ...over,
})

const codes = (html: string, over: Partial<PageContext> = {}) => checkPage(parsePage(html), ctx(over)).map((i) => i.code)

describe('urls', () => {
  it('normalises fragment, host case and trailing slash but keeps the query', () => {
    expect(normalizeUrl('https://WWW.6figjobs.com/jobs/#top')).toBe('https://www.6figjobs.com/jobs')
    expect(normalizeUrl('/jobs?page=2', ORIGIN)).toBe('https://www.6figjobs.com/jobs?page=2')
    expect(normalizeUrl('https://www.6figjobs.com/')).toBe('https://www.6figjobs.com/')
  })

  it('ignores mailto, tel and javascript links', () => {
    expect(normalizeUrl('mailto:a@b.c')).toBeNull()
    expect(normalizeUrl('javascript:void(0)')).toBeNull()
  })

  it('tells job, article, home and listing pages apart', () => {
    expect(pageKind(`${ORIGIN}/`)).toBe('home')
    expect(pageKind(`${ORIGIN}/job/x-j-1`)).toBe('job')
    expect(pageKind(`${ORIGIN}/blog/x`)).toBe('article')
    expect(pageKind(`${ORIGIN}/jobs/remote`)).toBe('listing')
  })
})

describe('parsePage', () => {
  it('reads the head, headings, links and structured data', () => {
    const f = parsePage(
      page({
        head: '<link rel="alternate" hreflang="en" href="https://www.6figjobs.com/x">',
        body: '<h4>skipped</h4><a href="https://elsewhere.test/apply" rel="nofollow noopener">Apply</a><img src="a.png"><img src="b.png" alt="">',
      }),
    )
    expect(f.title).toContain('Senior Engineer')
    expect(f.canonicals).toEqual([`${ORIGIN}/job/senior-engineer-j-abc123`])
    expect(f.h1Count).toBe(1)
    expect(f.headingSkips).toBe(1)
    expect(f.hreflang).toEqual([{ lang: 'en', href: 'https://www.6figjobs.com/x' }])
    expect(f.links.find((l) => l.href.includes('elsewhere'))?.nofollow).toBe(true)
    expect(f.imagesTotal).toBe(2)
    expect(f.imagesMissingAlt).toBe(1) // alt="" is a valid decorative image
    expect(f.wordCount).toBeGreaterThan(150)
    expect(f.lang).toBe('en')
  })

  it('keeps invalid JSON-LD as an error instead of throwing', () => {
    const f = parsePage('<html><head><script type="application/ld+json">{not json</script></head><body></body></html>')
    expect(f.jsonLd).toHaveLength(1)
    expect(f.jsonLd[0].error).toBeTruthy()
  })

  it('gives identical text the same hash and different text another', () => {
    expect(parsePage(page()).textHash).toBe(parsePage(page()).textHash)
    expect(parsePage(page()).textHash).not.toBe(parsePage(page({ body: '<p>more words</p>' })).textHash)
  })
})

describe('json-ld helpers', () => {
  it('flattens @graph and arrays', () => {
    const nodes = flattenJsonLd([{ data: { '@graph': [{ '@type': 'WebSite' }, { '@type': ['Organization', 'Thing'] }] } }, { data: [{ '@type': 'BreadcrumbList' }] }])
    expect(nodes.flatMap(typesOf)).toEqual(expect.arrayContaining(['WebSite', 'Organization', 'Thing', 'BreadcrumbList']))
  })
})

describe('checkJobPosting', () => {
  const severities = (over: Record<string, unknown>) => checkJobPosting(posting(over), NOW).map((i) => `${i.severity}:${i.code}`)

  it('passes a complete posting', () => {
    expect(checkJobPosting(posting(), NOW)).toEqual([])
  })

  it('flags a posting that has expired as critical', () => {
    expect(severities({ validThrough: '2026-11-01T00:00:00Z' })).toContain('critical:jp-expired')
  })

  it('requires a location, or remote plus where applicants may live', () => {
    expect(severities({ jobLocation: undefined })).toContain('critical:jp-no-location')
    expect(severities({ jobLocation: undefined, jobLocationType: 'TELECOMMUTE' })).toContain('critical:jp-no-location')
    expect(severities({ jobLocation: undefined, jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: 'US' } })).toEqual([])
    expect(severities({ jobLocationType: 'TELECOMMUTE' })).toContain('warning:jp-remote-no-applicant-location')
  })

  it('requires organisation, description and datePosted', () => {
    expect(severities({ hiringOrganization: undefined })).toContain('critical:jp-missing-organization')
    expect(severities({ description: ' ' })).toContain('critical:jp-missing-description')
    expect(severities({ datePosted: undefined })).toContain('critical:jp-missing-date-posted')
    expect(severities({ datePosted: 'yesterday-ish' })).toContain('critical:jp-bad-date-posted')
  })

  it('checks salary and employment type', () => {
    expect(severities({ baseSalary: undefined })).toContain('warning:jp-no-salary')
    expect(severities({ baseSalary: { currency: 'USD', value: { minValue: 'lots' } } })).toContain('warning:jp-salary-invalid')
    expect(severities({ baseSalary: { value: { minValue: 1 } } })).toContain('warning:jp-salary-invalid')
    expect(severities({ employmentType: 'FULLTIME' })).toContain('warning:jp-bad-employment-type')
  })

  it('warns when validThrough is before datePosted, and notes a missing validThrough', () => {
    expect(severities({ validThrough: '2026-11-01T00:00:00Z', datePosted: '2026-11-08T00:00:00Z' })).toEqual(expect.arrayContaining(['critical:jp-expired']))
    expect(severities({ validThrough: undefined })).toContain('info:jp-no-valid-through')
  })
})

describe('jobSignature', () => {
  it('separates the same role in two cities and treats remote as a place', () => {
    const a = jobSignature(posting())
    const b = jobSignature(posting({ jobLocation: { address: { addressLocality: 'Boise' } } }))
    const r = jobSignature(posting({ jobLocation: undefined, jobLocationType: 'TELECOMMUTE' }))
    expect(a.place).toBe('austin')
    expect(b.place).toBe('boise')
    expect(r.place).toBe('remote')
    expect(a.org).toBe('Acme')
  })
})

describe('jobSignature description hash', () => {
  it('matches the same text under different employer names and ignores markup and case', () => {
    const a = jobSignature(posting({ hiringOrganization: { name: 'Cantor Fitzgerald' }, description: '<p>Lead the  <b>asset management</b> team. </p>' }))
    const b = jobSignature(posting({ hiringOrganization: { name: 'Newmark Group' }, description: 'lead the asset management team.' }))
    const c = jobSignature(posting({ description: 'A different role entirely.' }))
    expect(a.desc).toBe(b.desc)
    expect(a.desc).not.toBe(c.desc)
    expect(jobSignature(posting({ description: '' })).desc).toBe('')
  })
})

describe('analyzeGraph', () => {
  const U = (p: string) => `${ORIGIN}${p}`
  const node = (p: string, links: string[], over: Partial<{ indexable: boolean; inSitemap: boolean }> = {}) => ({
    url: U(p),
    links: links.map(U),
    indexable: true,
    inSitemap: true,
    ...over,
  })

  it('finds a sitemap page that nothing links to', () => {
    const found = analyzeGraph([node('/', ['/jobs']), node('/jobs', []), node('/job/lonely', [])], U('/'))
    expect(found).toEqual([expect.objectContaining({ code: 'orphan-page', url: U('/job/lonely') })])
  })

  it('does not call a job an orphan when only a page outside the sitemap (pagination) links to it', () => {
    const found = analyzeGraph(
      [node('/', ['/jobs']), node('/jobs', ['/jobs?page=2']), node('/jobs?page=2', ['/job/deep'], { inSitemap: false }), node('/job/deep', [])],
      U('/'),
    )
    expect(found).toEqual([])
  })

  it('reports pages deeper than the limit as deep, and pages linked only from unreachable pages as unreachable', () => {
    const chain = [node('/', ['/a']), node('/a', ['/b']), node('/b', ['/c']), node('/c', ['/d']), node('/d', ['/e']), node('/e', [])]
    const island = [node('/x', ['/y']), node('/y', ['/x'])]
    const found = analyzeGraph([...chain, ...island], U('/'), 4)
    expect(found).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'deep-page', url: U('/e'), detail: '5 clicks from the homepage' }),
        expect.objectContaining({ code: 'unreachable-from-home', url: U('/x') }),
        expect.objectContaining({ code: 'unreachable-from-home', url: U('/y') }),
      ]),
    )
    expect(found.find((f) => f.url === U('/d'))).toBeUndefined()
  })

  it('ignores self links, noindex pages and pages that are not in the sitemap', () => {
    const found = analyzeGraph(
      [node('/', ['/self']), node('/self', ['/self']), node('/hidden', [], { indexable: false }), node('/unlisted', [], { inSitemap: false })],
      U('/'),
    )
    expect(found).toEqual([])
  })

  it('treats trailing slashes and fragments as the same URL', () => {
    const found = analyzeGraph([node('/', ['/jobs/#top']), node('/jobs', [])], U('/'))
    expect(found).toEqual([])
  })
})

describe('checkPage', () => {
  it('finds nothing critical or warning on a healthy job page', () => {
    const bad = checkPage(parsePage(page()), ctx()).filter((i) => i.severity !== 'info')
    expect(bad).toEqual([])
  })

  it('flags a noindex page that is in the sitemap', () => {
    expect(codes(page({ head: '<meta name="robots" content="noindex, follow">' }))).toContain('noindex-in-sitemap')
    expect(codes(page(), { xRobotsTag: 'noindex' })).toContain('noindex-in-sitemap')
    expect(codes(page({ head: '<meta name="robots" content="noindex, follow">' }), { inSitemap: false })).not.toContain('noindex-in-sitemap')
  })

  it('flags hreflang on a noindex page (it causes Search Console warnings)', () => {
    const html = page({ head: '<meta name="robots" content="noindex"><link rel="alternate" hreflang="de" href="https://www.6figjobs.com/de">' })
    expect(codes(html, { inSitemap: false })).toContain('hreflang-on-noindex')
  })

  it('does not run title, description or canonical rules on a noindex page', () => {
    const html = '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="x"><meta name="robots" content="noindex"></head><body><h1>x</h1><a href="/a">a</a></body></html>'
    const c = codes(html, { inSitemap: false })
    expect(c).not.toContain('missing-title')
    expect(c).not.toContain('missing-canonical')
  })

  it('checks the canonical: missing, several, relative, off-site, and different from the URL', () => {
    expect(codes(page().replace(/<link rel="canonical"[^>]*>/, ''))).toContain('missing-canonical')
    expect(codes(page({ head: '<link rel="canonical" href="https://www.6figjobs.com/other">' }))).toContain('multiple-canonicals')
    expect(codes(page().replace(`${ORIGIN}/job/senior-engineer-j-abc123`, '/job/senior-engineer-j-abc123'))).toContain('canonical-relative')
    expect(codes(page().replace(ORIGIN, 'https://6figjobs.com'))).toContain('canonical-wrong-origin')
    const mismatch = checkPage(parsePage(page().replace('j-abc123"', 'j-zzz999"')), ctx())
    expect(mismatch.find((i) => i.code === 'canonical-mismatch')?.severity).toBe('critical')
    const notListed = checkPage(parsePage(page().replace('j-abc123"', 'j-zzz999"')), ctx({ inSitemap: false }))
    expect(notListed.find((i) => i.code === 'canonical-mismatch')?.severity).toBe('info')
  })

  it('accepts a trailing slash difference as the same URL', () => {
    expect(codes(page(), { url: `${ORIGIN}/job/senior-engineer-j-abc123/` })).not.toContain('canonical-mismatch')
  })

  it('requires a JobPosting on a job page and reports its problems', () => {
    expect(codes(page({ ld: [{ '@type': 'BreadcrumbList' }] }))).toContain('jp-missing')
    expect(codes(page({ ld: [posting({ validThrough: '2026-11-01T00:00:00Z' }), { '@type': 'BreadcrumbList' }] }))).toContain('jp-expired')
    expect(codes(page({ head: '<script type="application/ld+json">{oops</script>' }))).toContain('jsonld-invalid')
  })

  it('checks delivery: slow, uncompressed and non-HTML responses', () => {
    expect(codes(page(), { ttfbMs: 3500 })).toContain('slow-response')
    expect(codes(page(), { contentEncoding: '' })).toContain('no-compression')
    expect(codes(page(), { contentType: 'application/json' })).toContain('non-html-content-type')
  })

  it('checks the basics: H1, lang, viewport, description and thin content', () => {
    const bare = '<html><head><title>Short</title></head><body><p>hi</p></body></html>'
    const c = codes(bare, { url: `${ORIGIN}/jobs/remote` })
    expect(c).toEqual(expect.arrayContaining(['missing-h1', 'missing-html-lang', 'missing-viewport', 'missing-meta-description', 'title-too-short', 'thin-content', 'missing-canonical', 'no-outgoing-links']))
  })
})

describe('robots.txt', () => {
  const robots = parseRobots(`
User-agent: *
Allow: /
Disallow: /search
Disallow: /api/
Disallow: /*.pdf$

User-agent: GPTBot
Disallow: /

Sitemap: https://www.6figjobs.com/sitemap.xml
Sitemap: https://www.6figjobs.com/sitemap-jobs.xml
`)

  it('reads only the * group and every Sitemap line', () => {
    expect(robots.disallow).toEqual(['/search', '/api/', '/*.pdf$'])
    expect(robots.sitemaps).toHaveLength(2)
  })

  it('blocks matching paths and allows the rest', () => {
    expect(isAllowedByRobots(robots, '/jobs/remote')).toBe(true)
    expect(isAllowedByRobots(robots, '/search?q=x')).toBe(false)
    expect(isAllowedByRobots(robots, '/api/jobs')).toBe(false)
    expect(isAllowedByRobots(robots, '/files/cv.pdf')).toBe(false)
    expect(isAllowedByRobots(robots, '/files/cv.pdf?x=1')).toBe(true) // `$` anchors the end
  })

  it('lets the longest matching rule win, and Allow win a tie', () => {
    const r = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/open\nDisallow: /same\nAllow: /same')
    expect(isAllowedByRobots(r, '/private/secret')).toBe(false)
    expect(isAllowedByRobots(r, '/private/open/x')).toBe(true)
    expect(isAllowedByRobots(r, '/same')).toBe(true)
  })

  it('detects a site-wide block', () => {
    expect(parseRobots('User-agent: *\nDisallow: /').disallow).toContain('/')
  })
})

describe('percentile', () => {
  it('handles empty and small lists', () => {
    expect(percentile([], 95)).toBe(0)
    expect(percentile([5], 50)).toBe(5)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(6)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 100)).toBe(10)
  })
})
