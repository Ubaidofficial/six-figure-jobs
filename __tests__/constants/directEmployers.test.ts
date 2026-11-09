import { DIRECT_EMPLOYERS } from '../../lib/constants/directEmployers'

const HOSTS = { greenhouse: 'https://boards.greenhouse.io/', ashby: 'https://jobs.ashbyhq.com/', lever: 'https://jobs.lever.co/' }
const WORKDAY = /^https:\/\/[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com\/[A-Za-z0-9_-]+$/

describe('DIRECT_EMPLOYERS', () => {
  it('includes the employers the owner asked for', () => {
    const slugs = DIRECT_EMPLOYERS.map((e) => e.slug)
    for (const s of ['openai', 'anthropic', 'spacex', 'xai', 'nvidia', 'salesforce', 'adobe', 'crowdstrike']) expect(slugs).toContain(s)
  })

  it('has one entry per company page and per board', () => {
    const slugs = DIRECT_EMPLOYERS.map((e) => e.slug)
    const boards = DIRECT_EMPLOYERS.map((e) => e.boardUrl)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(new Set(boards).size).toBe(boards.length)
  })

  it('gives every employer a board URL on its own provider and a page-style slug', () => {
    for (const e of DIRECT_EMPLOYERS) {
      if (e.provider === 'workday') {
        expect(e.boardUrl).toMatch(WORKDAY)
        continue
      }
      expect(e.boardUrl.startsWith(HOSTS[e.provider])).toBe(true)
      expect(e.boardUrl.slice(HOSTS[e.provider].length)).toMatch(/^[a-z0-9-]+$/)
      expect(e.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })
})
