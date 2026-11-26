import { atsLinkInPage, cleanPageLink, findDirectLink, isEmployerLink, type DirectLinkDeps } from '../../lib/scrapers/freehireDirectLink'

const deps = (over: Partial<DirectLinkDeps> = {}): DirectLinkDeps & { pages: string[] } => {
  const pages: string[] = []
  return {
    pages,
    dataJob: async () => null,
    copies: async () => [],
    page: async (url) => {
      pages.push(url)
      return null
    },
    ...over,
  }
}

describe('isEmployerLink', () => {
  it('accepts employers and their ATS, refuses boards, aggregators and freehire', () => {
    expect(isEmployerLink('https://acme.wd5.myworkdayjobs.com/x')).toBe(true)
    expect(isEmployerLink('https://careers.microsoft.com/job/1')).toBe(true)
    expect(isEmployerLink('https://www.linkedin.com/jobs/view/1')).toBe(false)
    expect(isEmployerLink('https://builtin.com/job/1')).toBe(false)
    expect(isEmployerLink('https://freehire.me/api/v1/go/x?src=web')).toBe(false)
    expect(isEmployerLink('http://')).toBe(false)
    expect(isEmployerLink(null)).toBe(false)
  })
})

describe('reading a board page', () => {
  it('cleans a link taken out of HTML or JSON (entities, the JSON after it, utm tags)', () => {
    expect(
      cleanPageLink('https://jobs.smartrecruiters.com/Wavestone1/7440001?oga=true&#38;utm_source=Jobgether&#38;utm_medium=website&#34;,&#34;isEasyApply&#34;:false'),
    ).toBe('https://jobs.smartrecruiters.com/Wavestone1/7440001?oga=true')
  })

  it('takes only an ATS link from a page, not the company homepage or news pages around it', () => {
    const html = '<a href="https://www.newyorklife.com/newsroom">News</a> <a href="https://sedgwick.wd1.myworkdayjobs.com/Sedgwick/job/X_R1">Apply</a>'
    expect(atsLinkInPage(html)).toBe('https://sedgwick.wd1.myworkdayjobs.com/Sedgwick/job/X_R1')
    expect(atsLinkInPage('<a href="https://www.newyorklife.com/newsroom">News</a>')).toBeNull()
  })
})

describe('findDirectLink', () => {
  it('uses the job\'s own source_url first', async () => {
    const d = deps()
    const r = await findDirectLink('s', 'https://www.linkedin.com/jobs/view/1', 'https://boards.greenhouse.io/acme/jobs/1', d)
    expect(r).toEqual({ url: 'https://boards.greenhouse.io/acme/jobs/1', via: 'source_url' })
  })

  it('then a copy of the posting from another source', async () => {
    const d = deps({
      copies: async () => [{ public_slug: 's' }, { public_slug: 'other' }],
      dataJob: async (slug) => (slug === 'other' ? { url: 'https://jobs.lever.co/acme/1' } : null),
    })
    expect(await findDirectLink('s', 'https://www.xing.com/jobs/1', null, d)).toEqual({ url: 'https://jobs.lever.co/acme/1', via: 'copy' })
  })

  it('never opens LinkedIn or XING pages', async () => {
    const d = deps()
    expect(await findDirectLink('s', 'https://www.linkedin.com/jobs/view/1', null, d)).toBeNull()
    expect(await findDirectLink('s', 'https://www.xing.com/jobs/1', null, d)).toBeNull()
    expect(d.pages).toEqual([])
  })

  it('reads an allowed board\'s page, but not one with a query string (Jobgether\'s robots.txt)', async () => {
    const d = deps({
      page: async (url) => {
        d.pages.push(url)
        return { finalUrl: url, html: '"https://jobs.smartrecruiters.com/ServiceNow/744000162613830-sales"' }
      },
    })
    expect(await findDirectLink('s', 'https://jobgether.com/offer/abc-sales', null, d)).toEqual({
      url: 'https://jobs.smartrecruiters.com/ServiceNow/744000162613830-sales',
      via: 'page',
    })
    expect(await findDirectLink('s', 'https://jobgether.com/offer/abc-sales?ref=x', null, d)).toBeNull()
    expect(d.pages).toEqual(['https://jobgether.com/offer/abc-sales'])
  })

  it('keeps nothing when no employer link exists (the caller keeps the board link)', async () => {
    expect(await findDirectLink('s', 'https://www.whatjobs.com/job/1', null, deps())).toBeNull()
  })
})
