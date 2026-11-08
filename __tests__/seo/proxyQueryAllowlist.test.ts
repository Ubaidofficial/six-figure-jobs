/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('../../lib/jobs/jobAvailabilityCheck', () => ({ checkJobAvailability: jest.fn() }))

import { proxy } from '../../proxy'

const get = (path: string) => proxy(new NextRequest(`https://www.6figjobs.com${path}`))
const redirectTarget = (res: Response) => (res.status === 301 ? new URL(res.headers.get('location')!).search : null)

describe('proxy: query allowlist on /jobs', () => {
  it.each([
    '?role=software-engineer',
    '?seniority=senior&seniority=lead',
    '?companySize=51-200',
    '?country=US&remoteMode=remote&remoteRegion=us-only&city=zug&minSalary=200000&q=react',
  ])('lets the sidebar filters through: %s', async (query) => {
    expect(redirectTarget(await get(`/jobs${query}`))).toBeNull()
  })

  it('still strips parameters it does not know, keeping the ones it does', async () => {
    expect(redirectTarget(await get('/jobs?role=data-engineer&sessionid=abc&country=US'))).toBe('?role=data-engineer&country=US')
  })
})
