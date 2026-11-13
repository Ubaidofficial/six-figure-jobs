import { GET } from '../../app/api/health/route'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({ prisma: { $queryRaw: jest.fn() } }))

const queryRaw = prisma.$queryRaw as unknown as jest.Mock

describe('/api/health', () => {
  beforeEach(() => queryRaw.mockReset())

  it('answers 200 when the database has live jobs', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('answers 503 when the database holds no live jobs (empty or wrong database)', async () => {
    queryRaw.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: 'no live jobs' })
  })

  it('answers 503 with only the Prisma code when the query fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    queryRaw.mockRejectedValue(Object.assign(new Error("Can't reach database server at secret-host:5432"), { code: 'P1001' }))
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: 'database unavailable', code: 'P1001' })
    expect(JSON.stringify(body)).not.toContain('secret-host')
  })
})
