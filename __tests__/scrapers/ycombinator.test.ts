jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/jobs/ingestBoardJob', () => ({ ingestBoardJob: jest.fn() }))

import {
  collectYcJobs,
  parseYcCompanyJobs,
  parseYcJobPage,
  parseYcSitemap,
  ycCreatedRecently,
  ycJobCode,
  ycPayPasses,
  type YcJob,
} from '../../lib/scrapers/ycombinator'

// Structure as seen on ycombinator.com on 2026-11-19 (sitemap, Inertia data-page props, JobPosting JSON-LD);
// companies, jobs and text invented.
const BASE = 'https://www.ycombinator.com'
const jobUrl = (slug: string, code: string, title: string) => `${BASE}/companies/${slug}/jobs/${code}-${title}`

const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset>
<url><loc>${BASE}/jobs/role/software-engineer</loc><lastmod>2026-11-19</lastmod></url>
<url><loc>${jobUrl('acme', 'AAAAAA1', 'staff-engineer')}</loc><lastmod>2026-11-18</lastmod></url>
<url><loc>${jobUrl('acme', 'AAAAAA2', 'old-engineer')}</loc><lastmod>2026-11-18</lastmod></url>
<url><loc>${jobUrl('acme', 'AAAAAA3', 'low-pay-analyst')}</loc><lastmod>2026-11-18</lastmod></url>
<url><loc>${jobUrl('acme', 'AAAAAA4', 'eu-designer')}</loc><lastmod>2026-11-18</lastmod></url>
<url><loc>${jobUrl('beta', 'BBBBBB1', 'founding-engineer')}</loc><lastmod>2026-11-10</lastmod></url>
<url><loc>${jobUrl('stale', 'CCCCCC1', 'engineer')}</loc><lastmod>2026-03-25</lastmod></url>
</urlset>`

const posting = (id: number, slug: string, code: string, title: string, salaryRange: string, createdAt: string, location = 'San Francisco, CA, US') => ({
  id,
  title: title.replace(/-/g, ' '),
  url: `/companies/${slug}/jobs/${code}-${title}`,
  applyUrl: `https://account.ycombinator.com/authenticate?continue=x${id}`,
  location,
  type: 'Full-time',
  salaryRange,
  createdAt,
})

const inertia = (component: string, props: object) =>
  `<html><body><div id="app" data-page="${JSON.stringify({ component, props }).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></div></body></html>`

const acmePage = inertia('WaasShowJobsPage', {
  company: { name: 'Acme & Co', website: 'https://acme.example', linkedin_url: 'https://www.linkedin.com/company/acme' },
  jobPostings: [
    posting(101, 'acme', 'AAAAAA1', 'staff-engineer', '$200K - $275K', '5 days', 'Remote (US)'),
    posting(102, 'acme', 'AAAAAA2', 'old-engineer', '$200K - $275K', '6 months'),
    posting(103, 'acme', 'AAAAAA3', 'low-pay-analyst', '$60K - $80K', '2 days'),
    posting(104, 'acme', 'AAAAAA4', 'eu-designer', '€120K - €150K EUR', 'about 3 hours', 'Dublin, Ireland'),
  ],
})
const betaPage = inertia('WaasShowJobsPage', {
  company: { name: 'Beta', website: '', linkedin_url: null },
  jobPostings: [posting(201, 'beta', 'BBBBBB1', 'founding-engineer', '$180K - $220K', '9 days')],
})

const jobPage = (description: string, datePosted: string) => `<html><head>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org/',
  '@type': 'JobPosting',
  title: 'Staff Engineer',
  description,
  datePosted,
  // YC says USD here even for euro pay; the scraper must not read pay from it.
  baseSalary: { '@type': 'MonetaryAmount', currency: 'USD', value: { minValue: 120000, maxValue: 150000 } },
})}</script></head><body><div id="app" data-page="{}"></div></body></html>`

describe('ycombinator.com', () => {
  it('reads the job code from a job URL', () => {
    expect(ycJobCode(jobUrl('acme', 'AAAAAA1', 'staff-engineer'))).toBe('AAAAAA1')
    expect(ycJobCode(`${BASE}/jobs/role/software-engineer`)).toBeNull()
  })

  it('groups the sitemap job pages by company, with their last-modified dates', () => {
    const map = parseYcSitemap(sitemap)
    expect([...map.keys()]).toEqual(['acme', 'beta', 'stale'])
    expect(map.get('acme')!.map((j) => j.code)).toEqual(['AAAAAA1', 'AAAAAA2', 'AAAAAA3', 'AAAAAA4'])
    expect(map.get('stale')![0].lastmod).toBe('2026-03-25')
  })

  it('passes yearly pay that can clear the gate, in any currency, and nothing else', () => {
    expect(ycPayPasses('$200K - $275K')).toBe(true)
    expect(ycPayPasses('€120K - €150K EUR')).toBe(true)
    expect(ycPayPasses('$60K - $80K')).toBe(false)
    expect(ycPayPasses('$40 - $60 / hr')).toBe(false)
    expect(ycPayPasses('')).toBe(false)
    expect(ycPayPasses(undefined)).toBe(false)
  })

  it('treats ages in minutes, hours or days as recent, months and years as not', () => {
    for (const age of ['less than a minute', 'about 2 hours', '1 day', '29 days']) expect(ycCreatedRecently(age)).toBe(true)
    for (const age of ['about 1 month', '6 months', 'over 1 year', 'almost 2 years']) expect(ycCreatedRecently(age)).toBe(false)
  })

  it('reads a company jobs page: the company and its recent postings with passing pay', () => {
    const parsed = parseYcCompanyJobs(acmePage)!
    expect(parsed.company).toEqual({ name: 'Acme & Co', website: 'https://acme.example', linkedinUrl: 'https://www.linkedin.com/company/acme' })
    expect(parsed.postings.map((p) => p.id)).toEqual([101, 104])
    expect(parsed.postings[0]).toMatchObject({ code: 'AAAAAA1', url: jobUrl('acme', 'AAAAAA1', 'staff-engineer'), location: 'Remote (US)', type: 'Full-time', salaryRange: '$200K - $275K' })
    expect(parseYcCompanyJobs(betaPage)!.company.website).toBeNull()
    expect(parseYcCompanyJobs('<html><body>nothing</body></html>')).toBeNull()
  })

  it('reads a job page: description HTML and posting date from the JSON-LD', () => {
    const detail = parseYcJobPage(jobPage('<p>Build things.</p>', '2026-11-14T08:37:00Z'))!
    expect(detail.descriptionHtml).toBe('<p>Build things.</p>')
    expect(detail.postedAt?.toISOString()).toBe('2026-11-14T08:37:00.000Z')
    expect(parseYcJobPage(jobPage('', '2026-11-14T08:37:00Z'))).toBeNull()
  })

  const pages: Record<string, string> = {
    [`${BASE}/jobs/sitemap`]: sitemap,
    [`${BASE}/companies/acme/jobs`]: acmePage,
    [`${BASE}/companies/beta/jobs`]: betaPage,
  }
  const makeGet = (seen: string[]) => async (url: string) => {
    seen.push(url)
    return pages[url] ?? (url.includes('/jobs/') ? jobPage('<p>Role.</p>', '2026-11-15T00:00:00Z') : null)
  }
  const now = new Date('2026-11-19T12:00:00Z')

  it('reads recently changed companies newest first, skips stale and known jobs, and hands each job over as read', async () => {
    const seen: string[] = []
    const jobs: YcJob[] = []
    const result = await collectYcJobs({ get: makeGet(seen), now, onJob: async (j) => void jobs.push(j) })
    expect(jobs.map((j) => `${j.name}:${j.id}`)).toEqual(['Acme & Co:101', 'Acme & Co:104', 'Beta:201'])
    expect(jobs[0]).toMatchObject({ salaryRange: '$200K - $275K', descriptionHtml: '<p>Role.</p>', website: 'https://acme.example' })
    // The stale company (last changed in March) is never fetched; old and low-pay postings get no job-page request.
    expect(seen.some((u) => u.includes('/companies/stale/'))).toBe(false)
    expect(seen.some((u) => u.includes('AAAAAA2') || u.includes('AAAAAA3'))).toBe(false)
    expect(result).toMatchObject({ companyPages: 2, jobPages: 3, found: 3, blocked: null })
    expect(result.live.size).toBe(6)

    const known = await collectYcJobs({ get: makeGet([]), now, known: new Set(['AAAAAA1', 'AAAAAA4']), onJob: async () => {} })
    expect(known).toMatchObject({ jobPages: 1, found: 1 })
  })

  it('respects the company and job page caps', async () => {
    expect(await collectYcJobs({ get: makeGet([]), now, maxCompanyPages: 1, onJob: async () => {} })).toMatchObject({ companyPages: 1, jobPages: 2 })
    expect(await collectYcJobs({ get: makeGet([]), now, maxJobPages: 1, onJob: async () => {} })).toMatchObject({ companyPages: 1, jobPages: 1 })
  })
})
