jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/jobs/ingestBoardJob', () => ({ ingestBoardJob: jest.fn() }))

import { collectSpainJobs, parseSpainDetail, parseSpainListing } from '../../lib/scrapers/spainjobs'
import { collectUiuxJobs, parseUiuxJob, parseUiuxSitemap } from '../../lib/scrapers/uiuxjobsboard'
import { makePoliteGetter, SourceBlocked } from '../../lib/scrapers/utils/politeFetch'

// Class names and structure as seen on 2026-11-14; companies, jobs and text invented.
const card = (path: string, title: string, company: string, pay: string | null, place: string) => `
<article><div class="min-w-0"><h3 class="job-card-title text-lg"><a href="${path}" aria-label="${title} ${company}"><span><span>${title}</span></span></a></h3>
<div class="mt-0.5 flex"><span class="min-w-0 truncate font-medium text-ink" translate="no"><span>${company}</span></span><span>·</span><span class="shrink-0">2d ago</span></div></div>
<div class="order-3"><span class="flex items-center gap-2 font-medium text-ink">${pay ?? ''}<span aria-hidden="true">·</span></span><span class="text-ink">${place}</span></div></article>`

const spainListing = `<html><body><a href="/jobs/75k/madrid">Madrid</a>
${card('/companies/acme/senior-engineer--aaaa111111', 'Senior Engineer', 'Acme', '€86k – €122k', 'Remote from Spain')}
${card('/companies/bank/head-of-risk--bbbb222222', 'Head of Risk', 'Bank &amp; Co', '€105.8k – €196.6k', 'Hybrid in Madrid')}
${card('/companies/nopay/analyst--cccc333333', 'Analyst', 'NoPay', null, 'Madrid')}
</body></html>`

const spainDetail = `<html><body><nav><a target="_blank" href="https://www.portugaljobs.io">PT</a></nav>
<div class="prose max-w-none"><p>Build the platform. The salary range is €86,000 - €122,000 per year.</p></div>
<div class="prose max-w-none"><h3>Requirements</h3><ul><li>5 years</li></ul></div>
<a href="https://www.comeet.com/jobs/acme/26.003/senior-engineer/11.666" target="_blank" rel="noopener noreferrer">Apply</a></body></html>`

describe('spainjobs.io', () => {
  it('reads cards with pay, company and place, and skips a card with no pay', () => {
    const cards = parseSpainListing(spainListing)
    expect(cards.map((c) => c.externalId)).toEqual(['senior-engineer--aaaa111111', 'head-of-risk--bbbb222222'])
    expect(cards[0]).toEqual({
      externalId: 'senior-engineer--aaaa111111', path: '/companies/acme/senior-engineer--aaaa111111', title: 'Senior Engineer',
      company: 'Acme', salaryText: '€86k – €122k', location: 'Remote from Spain',
    })
    expect(cards[1]).toMatchObject({ company: 'Bank & Co', location: 'Hybrid in Madrid' })
  })

  it('reads the description blocks and the employer apply link, not the sister boards', () => {
    const d = parseSpainDetail(spainDetail)
    expect(d.applyUrl).toBe('https://www.comeet.com/jobs/acme/26.003/senior-engineer/11.666')
    expect(d.descriptionHtml).toContain('€86,000 - €122,000')
    expect(d.descriptionHtml).toContain('Requirements')
  })

  it('fetches each job page once, skips stored jobs, and respects the page budget', async () => {
    const calls: string[] = []
    const get = async (url: string) => {
      calls.push(url)
      return url.includes('/jobs/75k') && !url.includes('/companies/') && url.endsWith('/jobs/75k') ? spainListing : url.includes('/companies/') ? spainDetail : null
    }
    const out = await collectSpainJobs({ get, known: new Set(['head-of-risk--bbbb222222']) })
    expect(out.jobs.map((j) => j.externalId)).toEqual(['senior-engineer--aaaa111111'])
    expect(calls.filter((u) => u.includes('/companies/'))).toHaveLength(1)
    const limited = await collectSpainJobs({ get, maxDetailPages: 0 })
    expect(limited.jobs).toEqual([])
  })

  it('ends the run at a block and keeps what it had', async () => {
    let n = 0
    const get = async (url: string) => {
      if (++n === 3) throw new SourceBlocked('HTTP 403 from www.spainjobs.io')
      return url.endsWith('/jobs/100k') ? spainListing : url.includes('/companies/') ? spainDetail : null
    }
    const out = await collectSpainJobs({ get })
    expect(out.blocked).toBe('HTTP 403 from www.spainjobs.io')
    expect(out.jobs).toHaveLength(1)
  })
})

const uiuxPage = `<html><head><title>Remote Product Designer at Skyward in United States | UI/UX Jobs Board</title>
<script type="application/ld+json">{"@context":"https://schema.org/","@type":"JobPosting","datePosted":"2026-11-14T08:37:00.000Z","employmentType":["Full Time"],"hiringOrganization":{"@type":"Organization","name":"Skyward"},"title":"Product Designer","validThrough":"2027-01-14T08:37:00.000Z"}</script></head>
<body><div class="job-description min-w-0"><p>We design things.</p><div>$100,000 - $130,000 per year</div><p>We believe great work deserves great pay. Salary range is above.</p></div>
<a href="https://jobs.lever.co/skyward/abc" target="_blank" rel="nofollow noopener" class="btn btn-primary h-13">Apply</a></body></html>`

const sitemap = `<urlset><url><loc>https://uiuxjobsboard.com/design-jobs/ux-researcher</loc></url>
<url><loc>https://uiuxjobsboard.com/job/1500000-remote-anywhere-ux-designer</loc></url>
<url><loc>https://uiuxjobsboard.com/job/1677026-remote-united-states-product-designer</loc></url></urlset>`

describe('uiuxjobsboard.com', () => {
  it('lists job pages from the sitemap, newest id first', () => {
    expect(parseUiuxSitemap(sitemap).map((e) => e.id)).toEqual(['1677026', '1500000'])
  })

  it('reads a job page: JSON-LD facts, the description with its pay, the employer apply link', () => {
    const job = parseUiuxJob(uiuxPage)!
    expect(job).toMatchObject({
      title: 'Product Designer', company: 'Skyward', location: 'United States', remote: true,
      employmentType: 'Full Time', applyUrl: 'https://jobs.lever.co/skyward/abc',
    })
    expect(job.descriptionHtml).toContain('$100,000 - $130,000')
    expect(job.postedAt?.toISOString()).toBe('2026-11-14T08:37:00.000Z')
    expect(parseUiuxJob('<html><body>nothing</body></html>')).toBeNull()
  })

  it('keeps only jobs that state pay, skips stored ids and respects the page cap', async () => {
    const nopay = uiuxPage.replace('$100,000 - $130,000 per year', 'Competitive').replace('great pay. Salary range is above.', 'great work.')
    const get = async (url: string) => (url.endsWith('1.xml') ? sitemap : url.includes('1677026') ? uiuxPage : url.includes('1500000') ? nopay : null)
    const all = await collectUiuxJobs({ get })
    expect(all.jobs.map((j) => j.id)).toEqual(['1677026'])
    expect(all.pages).toBe(2)
    expect((await collectUiuxJobs({ get, known: new Set(['1677026']) })).pages).toBe(1)
    expect((await collectUiuxJobs({ get, maxPages: 1 })).pages).toBe(1)
  })
})

describe('makePoliteGetter', () => {
  const ok = (status: number, body = 'x') => async () => ({ status, text: async () => body })

  it('returns the body, null for a 404, and stops at 403 and 429', async () => {
    const sleep = async () => {}
    expect(await makePoliteGetter({ gapMs: 0, fetchImpl: ok(200, 'hi'), sleep })('https://a.example/x')).toBe('hi')
    expect(await makePoliteGetter({ gapMs: 0, fetchImpl: ok(404), sleep })('https://a.example/x')).toBeNull()
    await expect(makePoliteGetter({ gapMs: 0, fetchImpl: ok(403), sleep })('https://a.example/x')).rejects.toThrow(SourceBlocked)
    await expect(makePoliteGetter({ gapMs: 0, fetchImpl: ok(429), sleep })('https://a.example/x')).rejects.toThrow('HTTP 429 from a.example')
  })

  it('waits out the gap between requests', async () => {
    const waits: number[] = []
    const get = makePoliteGetter({ gapMs: 5000, fetchImpl: ok(200), sleep: async (ms) => void waits.push(ms) })
    await get('https://a.example/1')
    await get('https://a.example/2')
    expect(waits).toHaveLength(1)
    expect(waits[0]).toBeGreaterThan(0)
    expect(waits[0]).toBeLessThanOrEqual(5000)
  })
})
