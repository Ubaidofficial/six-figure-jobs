import { DIRECT_EMPLOYERS } from '../../lib/constants/directEmployers'

const HOSTS = { greenhouse: 'https://boards.greenhouse.io/', ashby: 'https://jobs.ashbyhq.com/', lever: 'https://jobs.lever.co/' }
const WORKDAY = /^https:\/\/[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com\/[A-Za-z0-9_-]+$/
// Oracle Recruiting Cloud candidate sites and Gem boards (added 2026-11-25).
const ORACLE = /^https:\/\/[a-z0-9.-]+\.oraclecloud\.com\/hcmUI\/CandidateExperience\/[a-z]{2}\/sites\/[A-Za-z0-9_-]+$/
const GEM = /^https:\/\/jobs\.gem\.com\/[a-z0-9-]+$/

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
      if (e.provider === 'workday' || e.provider === 'oraclecloud' || e.provider === 'gem') {
        expect(e.boardUrl).toMatch(e.provider === 'workday' ? WORKDAY : e.provider === 'gem' ? GEM : ORACLE)
        continue
      }
      expect(e.boardUrl.startsWith(HOSTS[e.provider])).toBe(true)
      // Lower case; a dot is allowed because some Ashby accounts are domain names ("kraken.com", 2026-11-25).
      expect(e.boardUrl.slice(HOSTS[e.provider].length)).toMatch(/^[a-z0-9.-]+$/)
      expect(e.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('gives websites as bare domains (no scheme, path, shortener or job-board host)', () => {
    for (const e of DIRECT_EMPLOYERS) {
      if (!e.website) continue
      expect(e.website).toMatch(/^([a-z0-9-]+\.)+[a-z]{2,}$/)
      expect(e.website).not.toMatch(/(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|bit\.ly)$/)
    }
  })
})
