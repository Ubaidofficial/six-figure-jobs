import { GET } from '../../app/api/jobs/route'
import { __clearMemoForTests } from '../../lib/cache/memo'
import { queryJobs } from '../../lib/jobs/queryJobs'

jest.mock('../../lib/jobs/queryJobs', () => ({ queryJobs: jest.fn() }))
jest.mock('../../lib/security/scrapeGuard', () => ({ guardUiApi: () => null }))

const query = queryJobs as unknown as jest.Mock
const get = (qs: string) => GET(new Request(`http://localhost:3000/api/jobs?${qs}`))
const lastInput = () => query.mock.calls[query.mock.calls.length - 1][0]

// /api/jobs serves "load more" and the live poll of /jobs and of the role pages (/jobs/<role>).
describe('/api/jobs', () => {
  beforeEach(() => {
    __clearMemoForTests()
    query.mockReset()
    query.mockResolvedValue({ jobs: [{ id: 'board:x:1', title: 'Engineer' }], total: 1, totalPages: 1 })
  })

  it('reads /jobs parameters as before (q, tech, several roles)', async () => {
    await get('page=2&q=rust&tech=go&role=a&role=b&country=us')
    const input = lastInput()
    expect(input.page).toBe(2)
    expect(input.keyword).toBe('rust')
    expect(input.tech).toBe('go')
    expect(input.roleSlugs).toEqual(['a', 'b'])
    expect(input.countryCode).toBe('US')
    expect(input.skillSlugs).toBeUndefined()
  })

  it('reads a role page the way the role page does: one role, its skill filters, no q or tech', async () => {
    await get('scope=role&role=data-scientist&role=other&q=rust&tech=go&skill=python&skill=sql&country=ca&remoteMode=remote')
    const input = lastInput()
    expect(input.roleSlugs).toEqual(['data-scientist'])
    expect(input.skillSlugs).toEqual(['python', 'sql'])
    expect(input.keyword).toBeUndefined()
    expect(input.tech).toBeUndefined()
    expect(input.countryCode).toBe('CA')
    expect(input.remoteMode).toBe('remote')
    expect(input.sortBy).toBe('date')
  })

  it('does not apply skill filters to /jobs itself, which does not read them', async () => {
    await get('skill=python')
    expect(lastInput().skillSlugs).toBeUndefined()
  })

  it('answers the live poll from memory for the same filters, and asks again for other filters', async () => {
    await get('live=1&role=a')
    await get('live=1&role=a')
    expect(query).toHaveBeenCalledTimes(1)
    await get('live=1&role=b')
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('does not keep ordinary "load more" requests, and ignores live past page 1', async () => {
    await get('page=2&role=a')
    await get('page=2&role=a')
    await get('page=2&role=a&live=1')
    expect(query).toHaveBeenCalledTimes(3)
  })

  it('gives public ids and links, never source fields', async () => {
    query.mockResolvedValue({ jobs: [{ id: 'board:x:1', title: 'Engineer', source: 'board:x', sourceRef: 'r' }], total: 1, totalPages: 1 })
    const body = await (await get('page=1')).json()
    expect(body.jobs[0].source).toBeUndefined()
    expect(body.jobs[0].sourceRef).toBeUndefined()
    expect(body.jobs[0].id).not.toContain('board:')
    expect(body.jobs[0].href).toMatch(/^\/job\//)
  })
})
