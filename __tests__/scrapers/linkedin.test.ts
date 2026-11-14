jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/jobs/ingestBoardJob', () => ({ ingestBoardJob: jest.fn() }))

import {
  collectLinkedInPostings,
  parseJobDetail,
  parseSearchCards,
  readOptionsFromEnv,
  titleHasSearchWords,
} from '../../lib/scrapers/linkedin'
import fixtures from './fixtures/linkedinGuest.json'

describe('parseSearchCards', () => {
  it('reads id, title, company, place and date from each card', () => {
    const cards = parseSearchCards(fixtures.search)
    expect(cards).toHaveLength(3)
    expect(cards[0]).toEqual({
      id: '1000000001',
      title: 'Staff Software Engineer, Payments',
      company: 'Acme Corp',
      companyUrl: 'https://www.linkedin.com/company/acme',
      location: 'Seattle, WA',
      postedAt: '2026-11-14',
      salaryText: null,
      url: 'https://www.linkedin.com/jobs/view/1000000001',
    })
    expect(cards[2].postedAt).toBeNull()
  })

  it('ignores markup that is not a card', () => {
    expect(parseSearchCards('<html><body><p>nothing</p></body></html>')).toEqual([])
  })
})

describe('parseJobDetail', () => {
  it('reads the description and criteria', () => {
    const d = parseJobDetail(fixtures.detailPay)
    expect(d.descriptionHtml).toContain('$263,600 USD - $395,400 USD')
    expect(d.employmentType).toBe('Full-time')
    expect(d.seniority).toBe('Not Applicable')
    expect(d.closed).toBe(false)
  })

  it('knows a closed posting', () => {
    expect(parseJobDetail(fixtures.detailClosed).closed).toBe(true)
  })
})

describe('titleHasSearchWords', () => {
  it('needs every word of the search in the title, as whole word starts', () => {
    expect(titleHasSearchWords('Senior Staff Software Engineers', 'staff software engineer')).toBe(true)
    expect(titleHasSearchWords('Staff Product Designer', 'staff software engineer')).toBe(false)
    expect(titleHasSearchWords('Machine Learning Engineer (C++)', 'machine learning engineer')).toBe(true)
  })
})

describe('collectLinkedInPostings', () => {
  const base = { queries: ['staff software engineer'], locations: ['United States'], maxPages: 1, hoursOld: 168, maxRequests: 100, sleep: async () => {} }

  function network(over: Record<string, { status: number; body: string }> = {}) {
    const urls: string[] = []
    const fetchImpl = async (url: string) => {
      urls.push(url)
      const hit = Object.entries(over).find(([k]) => url.includes(k))
      if (hit) return { status: hit[1].status, text: async () => hit[1].body }
      if (url.includes('seeMoreJobPostings')) return { status: 200, text: async () => fixtures.search }
      if (url.includes('/1000000001')) return { status: 200, text: async () => fixtures.detailPay }
      if (url.includes('/1000000003')) return { status: 200, text: async () => fixtures.detailNoPay }
      return { status: 404, text: async () => '' }
    }
    return { fetchImpl, urls }
  }

  it('keeps only title matches that state pay, and fetches only those pages', async () => {
    const { fetchImpl, urls } = network()
    const out = await collectLinkedInPostings({ ...base, fetchImpl })
    expect(out.blocked).toBeNull()
    expect(out.postings.map((p) => p.id)).toEqual(['1000000001'])
    expect(out.postings[0].salaryText).toBeNull() // pay is in the description, ingest reads it there
    // 1 search + 2 detail pages (the pastry chef title never matched, so its page was not fetched)
    expect(urls.filter((u) => u.includes('jobPosting/'))).toHaveLength(2)
    expect(out.requests).toBe(3)
  })

  it('does not fetch a posting that is already stored', async () => {
    const { fetchImpl, urls } = network()
    const out = await collectLinkedInPostings({ ...base, fetchImpl, knownIds: new Set(['1000000001', '1000000003']) })
    expect(out.postings).toEqual([])
    expect(urls).toHaveLength(1)
  })

  it('stops at the first rate limit and keeps what it had', async () => {
    const { fetchImpl, urls } = network({ '/1000000003': { status: 429, body: '' } })
    const out = await collectLinkedInPostings({ ...base, fetchImpl })
    expect(out.blocked).toBe('HTTP 429')
    expect(out.postings.map((p) => p.id)).toEqual(['1000000001'])
    expect(urls.filter((u) => u.includes('/1000000003'))).toHaveLength(1) // no retry
  })

  it('ends cleanly at the request cap, keeping what it had', async () => {
    const { fetchImpl, urls } = network()
    const out = await collectLinkedInPostings({ ...base, fetchImpl, maxRequests: 2 })
    expect(urls).toHaveLength(2)
    expect(out).toMatchObject({ blocked: null, budgetReached: true, requests: 2 })
    expect(out.postings.map((p) => p.id)).toEqual(['1000000001'])
  })

  it('stops at an auth wall', async () => {
    const { fetchImpl } = network({ seeMoreJobPostings: { status: 200, body: '<html>https://www.linkedin.com/authwall?trk=x</html>' } })
    expect((await collectLinkedInPostings({ ...base, fetchImpl })).blocked).toBe('auth wall')
  })
})

describe('readOptionsFromEnv', () => {
  it('reads | separated lists and numbers, with defaults', () => {
    const o = readOptionsFromEnv({ LINKEDIN_QUERIES: 'a|b', LINKEDIN_MAX_PAGES: '2' } as NodeJS.ProcessEnv)
    expect(o).toMatchObject({ queries: ['a', 'b'], maxPages: 2, hoursOld: 168, maxRequests: 120, locations: ['United States'] })
  })
})
