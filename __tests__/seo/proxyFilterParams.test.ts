jest.mock('../../lib/jobs/jobAvailabilityCheck', () => ({ checkJobAvailability: jest.fn(async () => null) }))

import { NextRequest } from 'next/server'
import { proxy } from '../../proxy'

const run = (path: string) => proxy(new NextRequest(`https://www.sixfigurejobs.net${path}`, { headers: { host: 'www.sixfigurejobs.net', 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/130.0 Safari/537.36' } }))
const redirected = (res: Response) => (res.status >= 300 && res.status < 400 ? res.headers.get('location') : null)

// The proxy sends our other hosts to getSiteUrl()'s host, and CI sets SITE_URL=http://localhost:3000; pin the production
// canonical host so these requests are on it.
const savedSiteUrl = process.env.SITE_URL
beforeAll(() => {
  process.env.SITE_URL = 'https://www.sixfigurejobs.net'
})
afterAll(() => {
  if (savedSiteUrl === undefined) delete process.env.SITE_URL
  else process.env.SITE_URL = savedSiteUrl
})

describe('proxy: listing filter parameters reach the page', () => {
  // Every parameter the filter panel writes (app/jobs/_components/JobsFilters.tsx). role, seniority and companySize were
  // removed with a 301 on /jobs, and seniority and tech with a 308 on role pages, so those filters never applied.
  it.each([
    '/jobs?role=software-engineer',
    '/jobs?role=software-engineer&role=data-engineer',
    '/jobs?seniority=senior',
    '/jobs?companySize=1000%2B',
    '/jobs?minSalary=200000&remoteMode=remote&country=GB&remoteRegion=global&tech=Python&visa=1&sort=salary',
    '/jobs/software-engineer?seniority=staff&tech=Go',
    '/jobs/200k-plus?seniority=staff&role=product-manager',
    '/jobs/location/united-states?companySize=51-200',
  ])('%s is served as is', async (path) => {
    expect(redirected(await run(path))).toBeNull()
  })

  it('still removes unknown parameters', async () => {
    expect(redirected(await run('/jobs?foo=1&remoteMode=remote'))).toBe('https://www.sixfigurejobs.net/jobs?remoteMode=remote')
  })

  it('still removes the legacy skill parameter on role pages', async () => {
    expect(redirected(await run('/jobs/software-engineer?skill=python'))).toBe('https://www.sixfigurejobs.net/jobs/software-engineer')
  })
})
