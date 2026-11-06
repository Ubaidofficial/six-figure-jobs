const mockResume = { upsert: jest.fn(), deleteMany: jest.fn() }
const mockKit = { findFirst: jest.fn(), update: jest.fn() }
jest.mock('@/lib/prisma', () => ({ prisma: { resume: mockResume, applicationKit: mockKit } }))

const mockUser = jest.fn()
jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockUser() }))

const mockGenerate = jest.fn()
jest.mock('@/lib/applykit/generate', () => {
  class KitError extends Error {
    constructor(readonly code: string, readonly status: number) {
      super(code)
    }
  }
  return { KitError, generateKit: (...a: unknown[]) => mockGenerate(...a) }
})

import { deleteResume, patchStatus, postGenerate, putResume } from '@/lib/applykit/api'
import { KitError } from '@/lib/applykit/generate'

const ORIGIN = 'https://www.6figjobs.com'
const req = (body: unknown, origin: string | null = ORIGIN) =>
  new Request(`${ORIGIN}/api/kit/x`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
const resumeText = 'Experienced engineer. '.repeat(20)
let n = 0

beforeEach(() => {
  process.env.AUTH_URL = ORIGIN
  jest.clearAllMocks()
  // a fresh user per test so one test's calls never count against another's rate limit
  mockUser.mockResolvedValue({ id: `u${++n}`, email: 'a@b.test', name: null })
})

describe('guards shared by every kit endpoint', () => {
  it.each([
    ['putResume', putResume],
    ['deleteResume', deleteResume],
    ['postGenerate', postGenerate],
    ['patchStatus', patchStatus],
  ])('%s refuses a request from another origin, or with none, before touching anything', async (_n, handler) => {
    expect((await handler(req({}, 'https://evil.test'))).status).toBe(403)
    expect((await handler(req({}, null))).status).toBe(403)
    expect(mockUser).not.toHaveBeenCalled()
  })

  it('answers 401 when nobody is signed in', async () => {
    mockUser.mockResolvedValue(null)
    expect((await putResume(req({ text: resumeText }))).status).toBe(401)
    expect(mockResume.upsert).not.toHaveBeenCalled()
  })

  it('rate-limits generation per user', async () => {
    mockGenerate.mockResolvedValue({ kit: {}, charged: 0 })
    const codes: number[] = []
    for (let i = 0; i < 10; i++) codes.push((await postGenerate(req({ job: 'a-j-1' }))).status)
    expect(codes.slice(0, 8).every((c) => c === 200)).toBe(true)
    expect(codes.slice(8)).toEqual([429, 429])
  })
})

describe('résumé', () => {
  it('saves for the signed-in user, ignoring any userId in the body', async () => {
    mockUser.mockResolvedValue({ id: 'me', email: null, name: null })
    const res = await putResume(req({ text: `${resumeText}\r\n`, userId: 'someone-else' }))
    expect(res.status).toBe(200)
    const arg = mockResume.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ userId: 'me' })
    expect(arg.create.userId).toBe('me')
    expect(arg.create.text).toBe(resumeText.trim())
  })

  it('rejects text that is too short, too long, or not text', async () => {
    expect(await (await putResume(req({ text: 'short' }))).json()).toEqual({ error: 'resume_too_short' })
    expect(await (await putResume(req({ text: 'x'.repeat(20_001) }))).json()).toEqual({ error: 'resume_too_long' })
    expect((await putResume(req({ text: 5 }))).status).toBe(400)
    expect((await putResume(req('not json'))).status).toBe(400)
    expect(mockResume.upsert).not.toHaveBeenCalled()
  })

  it('deletes only the signed-in user\'s résumé', async () => {
    mockUser.mockResolvedValue({ id: 'me', email: null, name: null })
    expect((await deleteResume(req({}))).status).toBe(200)
    expect(mockResume.deleteMany).toHaveBeenCalledWith({ where: { userId: 'me' } })
  })
})

describe('generate', () => {
  it('passes the session user and job slug to generateKit', async () => {
    mockUser.mockResolvedValue({ id: 'me', email: null, name: null })
    mockGenerate.mockResolvedValue({ kit: { id: 'k1' }, charged: 1 })
    const res = await postGenerate(req({ job: ' engineer-j-abc ' }))
    expect(await res.json()).toEqual({ kit: { id: 'k1' }, charged: 1 })
    expect(mockGenerate).toHaveBeenCalledWith('me', 'engineer-j-abc')
  })

  it('maps a KitError to its status and code, and an unexpected error to a plain 500', async () => {
    mockGenerate.mockRejectedValueOnce(new KitError('insufficient_credits', 402))
    const paid = await postGenerate(req({ job: 'a' }))
    expect([paid.status, await paid.json()]).toEqual([402, { error: 'insufficient_credits' }])
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGenerate.mockRejectedValueOnce(new Error('connection string postgres://secret'))
    const boom = await postGenerate(req({ job: 'a' }))
    expect([boom.status, await boom.json()]).toEqual([500, { error: 'server_error' }])
  })

  it('needs a job', async () => {
    expect((await postGenerate(req({}))).status).toBe(400)
    expect((await postGenerate(req({ job: 'x'.repeat(301) }))).status).toBe(400)
  })
})

describe('tracker status', () => {
  it('only touches a row that belongs to the signed-in user', async () => {
    mockUser.mockResolvedValue({ id: 'me', email: null, name: null })
    mockKit.findFirst.mockResolvedValue(null)
    expect((await patchStatus(req({ id: 'kit-of-someone-else', status: 'applied' }))).status).toBe(404)
    expect(mockKit.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'kit-of-someone-else', userId: 'me' } }))
    expect(mockKit.update).not.toHaveBeenCalled()
  })

  it('stamps appliedAt the first time a row leaves "saved", and clears it on going back', async () => {
    mockKit.findFirst.mockResolvedValue({ id: 'k1', appliedAt: null })
    await patchStatus(req({ id: 'k1', status: 'applied' }))
    expect(mockKit.update.mock.calls[0][0].data.appliedAt).toBeInstanceOf(Date)
    mockKit.findFirst.mockResolvedValue({ id: 'k1', appliedAt: new Date(5) })
    await patchStatus(req({ id: 'k1', status: 'interview' }))
    expect(mockKit.update.mock.calls[1][0].data.appliedAt).toBeUndefined() // kept
    await patchStatus(req({ id: 'k1', status: 'saved' }))
    expect(mockKit.update.mock.calls[2][0].data.appliedAt).toBeNull()
  })

  it('rejects unknown statuses, oversized notes and empty updates', async () => {
    expect((await patchStatus(req({ id: 'k1', status: 'hired!!' }))).status).toBe(400)
    expect((await patchStatus(req({ id: 'k1', notes: 'x'.repeat(2001) }))).status).toBe(400)
    expect((await patchStatus(req({ id: 'k1' }))).status).toBe(400)
    expect(mockKit.update).not.toHaveBeenCalled()
  })

  it('saves notes, and an empty note clears them', async () => {
    mockKit.findFirst.mockResolvedValue({ id: 'k1', appliedAt: null })
    await patchStatus(req({ id: 'k1', notes: '  call Tuesday ' }))
    await patchStatus(req({ id: 'k1', notes: '   ' }))
    expect(mockKit.update.mock.calls[0][0].data.notes).toBe('call Tuesday')
    expect(mockKit.update.mock.calls[1][0].data.notes).toBeNull()
  })
})
