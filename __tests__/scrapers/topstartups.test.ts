import {
  collectTopStartupsBoards,
  findExisting,
  parseTopStartupsJobs,
  parseTopStartupsSitemap,
  planBoard,
  type ExistingCompany,
  type TopStartupsBoard,
} from '../../lib/scrapers/topstartups'
import { SourceBlocked } from '../../lib/scrapers/utils/politeFetch'

// Structure as seen on topstartups.io on 2026-11-19 (sitemap and job cards); companies and jobs invented.
const sitemap = `<urlset>
<url><loc>https://topstartups.io/</loc></url>
<url><loc>https://topstartups.io/jobs/</loc></url>
<url><loc>https://topstartups.io/jobs/?job_location=Ann Arbor</loc></url>
<url><loc>https://topstartups.io/jobs/?role=Software%20Engineer&amp;page=2</loc></url>
<url><loc>https://topstartups.io/startup-salary-equity-database/</loc></url>
</urlset>`

const card = (company: string, apply: string, quoted = true) => `
<div class="col-12 infinite-item"><div class="card card-body" id="item-card-filter"><div class="row">
<div class="col-8 col-xl-5"><a href="http://www.${company.toLowerCase()}.example?utm_source=topstartups.io" target="_blank" id="startup-website-link"><h7 style="position:relative;">${company}</h7></a>
<br><a href ="${apply}" target="_blank" id="startup-website-link"><h5 id="job-title">Staff Engineer</h5></a></div>
<div class="col-10 col-md-6 col-xl-3"><br><a href=${quoted ? `"${apply}"` : apply} target="_blank" class="btn btn-primary" id="apply-button">Apply</a></div>
</div></div></div>`

const listing = `<html><body><p id="count_results">25,128 jobs</p><div class="row infinite-container">
${card('Acme', 'https://job-boards.greenhouse.io/acme/jobs/8274972', false)}
${card('Acme', 'https://job-boards.greenhouse.io/acme/jobs/8274999')}
${card('Beta AI', 'https://jobs.ashbyhq.com/BetaAI/19954a4c-7f3f-4231-8480-c7ec628e61a4')}
${card('Gamma', 'https://careers.gamma.example/jobs?gh_jid=8359240')}
</div></body></html>`

describe('topstartups.io', () => {
  it('takes the job listing pages from the sitemap and never a ?page= URL', () => {
    expect(parseTopStartupsSitemap(sitemap)).toEqual(['https://topstartups.io/jobs/', 'https://topstartups.io/jobs/?job_location=Ann%20Arbor'])
  })

  it('reads the board behind each job link and skips links that name no board', () => {
    expect(parseTopStartupsJobs(listing)).toEqual([
      { name: 'Acme', provider: 'greenhouse', atsUrl: 'https://boards.greenhouse.io/acme' },
      { name: 'Acme', provider: 'greenhouse', atsUrl: 'https://boards.greenhouse.io/acme' },
      { name: 'Beta AI', provider: 'ashby', atsUrl: 'https://jobs.ashbyhq.com/BetaAI' },
    ])
  })

  it('collects each board once across pages, respects the page cap and stops at a block', async () => {
    const get = async (url: string) => (url.endsWith('sitemap.xml') ? sitemap : listing)
    const all = await collectTopStartupsBoards({ get })
    expect(all).toMatchObject({ pages: 2, blocked: null })
    expect(all.boards.map((b) => b.name)).toEqual(['Acme', 'Beta AI'])
    expect((await collectTopStartupsBoards({ get, maxPages: 1 })).pages).toBe(1)

    const blocking = async (url: string) => {
      if (url.endsWith('sitemap.xml')) return sitemap
      throw new SourceBlocked('HTTP 403 from topstartups.io')
    }
    expect(await collectTopStartupsBoards({ get: blocking })).toMatchObject({ boards: [], pages: 1, blocked: 'HTTP 403 from topstartups.io' })
  })

  const board: TopStartupsBoard = { name: 'Beta AI', provider: 'ashby', atsUrl: 'https://jobs.ashbyhq.com/BetaAI' }
  const row = (over: Partial<ExistingCompany>): ExistingCompany => ({ id: 'c1', slug: 'other', name: 'Other', atsProvider: null, atsUrl: null, ...over })

  it('finds the existing company by board URL first, then slug, then name', () => {
    const byUrl = row({ id: 'url', atsProvider: 'ashby', atsUrl: 'https://jobs.ashbyhq.com/betaai/' })
    const bySlug = row({ id: 'slug', slug: 'beta-ai' })
    const byName = row({ id: 'name', name: 'beta ai' })
    expect(findExisting(board, [byName, bySlug, byUrl])?.id).toBe('url')
    expect(findExisting(board, [byName, bySlug])?.id).toBe('slug')
    expect(findExisting(board, [byName])?.id).toBe('name')
    expect(findExisting(board, [row({})])).toBeNull()
  })

  it('creates, attaches, or leaves alone a company that already points at a board', () => {
    expect(planBoard(board, null)).toEqual({ action: 'create', data: { name: 'Beta AI', slug: 'beta-ai', atsProvider: 'ashby', atsUrl: 'https://jobs.ashbyhq.com/BetaAI' } })
    expect(planBoard(board, row({ id: 'x' }))).toEqual({ action: 'attach', id: 'x', data: { atsProvider: 'ashby', atsUrl: 'https://jobs.ashbyhq.com/BetaAI' } })
    expect(planBoard(board, row({ atsProvider: 'ashby', atsUrl: 'https://jobs.ashbyhq.com/betaai' }))).toEqual({ action: 'skip', reason: 'already-onboarded' })
    expect(planBoard(board, row({ atsProvider: 'greenhouse', atsUrl: 'https://boards.greenhouse.io/beta' }))).toEqual({ action: 'skip', reason: 'has-other-ats-settings' })
    expect(planBoard({ ...board, name: '!!!' }, null)).toEqual({ action: 'skip', reason: 'no-slug' })
  })
})
