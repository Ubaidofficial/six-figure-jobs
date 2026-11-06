const mockUser = jest.fn()
jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockUser() }))

const mockPrepare = jest.fn()
const mockSave = jest.fn()
const mockApprove = jest.fn()
const mockCancel = jest.fn()
jest.mock('@/lib/autoapply/service', () => {
  class AutoApplyError extends Error {
    readonly status: number
    constructor(readonly code: string, readonly details?: unknown, status = 409) {
      super(code)
      this.status = status
    }
  }
  return {
    AutoApplyError,
    prepareApplication: (...a: unknown[]) => mockPrepare(...a),
    saveDraft: (...a: unknown[]) => mockSave(...a),
    approveApplication: (...a: unknown[]) => mockApprove(...a),
    cancelApplication: (...a: unknown[]) => mockCancel(...a),
  }
})

import { patchDraft, postApprove, postCancel, postPrepare } from '@/lib/autoapply/api'
import { AutoApplyError } from '@/lib/autoapply/service'

const ORIGIN = 'https://www.6figjobs.com'
const req = (body: unknown, origin: string | null = ORIGIN) =>
  new Request(`${ORIGIN}/api/autoapply/x`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
let n = 0

beforeEach(() => {
  process.env.AUTH_URL = ORIGIN
  jest.clearAllMocks()
  mockUser.mockResolvedValue({ id: `u${++n}`, email: 'a@b.test', name: null })
})

describe('guards shared by every auto-apply endpoint', () => {
  it.each([
    ['postPrepare', postPrepare],
    ['patchDraft', patchDraft],
    ['postApprove', postApprove],
    ['postCancel', postCancel],
  ])('%s refuses another origin, or none, before reading the session', async (_n, handler) => {
    expect((await handler(req({}, 'https://evil.test'))).status).toBe(403)
    expect((await handler(req({}, null))).status).toBe(403)
    expect(mockUser).not.toHaveBeenCalled()
  })

  it('answers 401 when nobody is signed in, and touches nothing', async () => {
    mockUser.mockResolvedValue(null)
    expect((await postApprove(req({ id: 'a', hash: 'h' }))).status).toBe(401)
    expect(mockApprove).not.toHaveBeenCalled()
  })

  it('rate-limits approvals per user', async () => {
    mockApprove.mockResolvedValue({ status: 'approved' })
    const codes: number[] = []
    for (let i = 0; i < 12; i++) codes.push((await postApprove(req({ id: 'a', hash: 'h' }))).status)
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true)
    expect(codes.slice(10)).toEqual([429, 429])
  })
})

describe('endpoints', () => {
  it('prepare passes the session user and the job slug, and returns only the id', async () => {
    mockUser.mockResolvedValue({ id: 'me', email: null, name: null })
    mockPrepare.mockResolvedValue({ id: 'app1', plan: { secret: 1 } })
    const res = await postPrepare(req({ job: ' engineer-j-abc ', userId: 'someone-else' }))
    expect(await res.json()).toEqual({ id: 'app1' })
    expect(mockPrepare).toHaveBeenCalledWith('me', 'engineer-j-abc')
    expect((await postPrepare(req({}))).status).toBe(400)
    expect((await postPrepare(req({ job: 'x'.repeat(301) }))).status).toBe(400)
  })

  it('draft saves details, answers and consent for the session user and returns the new hash', async () => {
    mockUser.mockResolvedValue({ id: 'me', email: null, name: null })
    mockSave.mockResolvedValue({ plan: { fields: [] }, errors: {}, missing: ['q1'], hash: 'h1' })
    const res = await patchDraft(req({ id: 'app1', answers: { q1: 'a' }, profile: { firstName: 'Ada' }, consent: true }))
    expect(await res.json()).toEqual({ plan: { fields: [] }, errors: {}, missing: ['q1'], hash: 'h1' })
    expect(mockSave).toHaveBeenCalledWith('me', 'app1', { answers: { q1: 'a' }, profile: { firstName: 'Ada' }, consent: true })
    expect((await patchDraft(req({ answers: {} }))).status).toBe(400)
  })

  it('approve forwards the hash the user reviewed; cancel needs an id', async () => {
    mockUser.mockResolvedValue({ id: 'me', email: null, name: null })
    mockApprove.mockResolvedValue({ status: 'approved' })
    expect(await (await postApprove(req({ id: 'app1', hash: 'h1' }))).json()).toEqual({ status: 'approved' })
    expect(mockApprove).toHaveBeenCalledWith('me', 'app1', 'h1')
    mockCancel.mockResolvedValue(undefined)
    expect((await postCancel(req({ id: 'app1' }))).status).toBe(200)
    expect(mockCancel).toHaveBeenCalledWith('me', 'app1')
    expect((await postCancel(req({}))).status).toBe(400)
  })

  it('maps a service error to its status and code, and an unexpected error to a plain 500 with nothing leaked', async () => {
    mockApprove.mockRejectedValueOnce(new (AutoApplyError as any)('insufficient_credits', { cost: 5 }, 402))
    const paid = await postApprove(req({ id: 'a', hash: 'h' }))
    expect([paid.status, await paid.json()]).toEqual([402, { error: 'insufficient_credits', details: { cost: 5 } }])
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockApprove.mockRejectedValueOnce(new Error('postgres://secret@host'))
    const boom = await postApprove(req({ id: 'a', hash: 'h' }))
    expect([boom.status, await boom.json()]).toEqual([500, { error: 'server_error' }])
  })
})
