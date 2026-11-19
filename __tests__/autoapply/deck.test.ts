const mockUser = jest.fn()
jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockUser() }))
const mockDeck = jest.fn()
jest.mock('@/lib/autoapply/deck', () => {
  const real = jest.requireActual('@/lib/autoapply/deck')
  return { ...real, swipeDeck: (...a: unknown[]) => mockDeck(...a) }
})
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { postDeck } from '@/lib/autoapply/api'
import { MAX_SKIP_IDS, readDeckRequest, toSwipeCard } from '@/lib/autoapply/deck'

const ORIGIN = 'https://www.6figjobs.com'
const req = (body: unknown, origin: string | null = ORIGIN) =>
  new Request(`${ORIGIN}/api/autoapply/deck`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  process.env.AUTH_URL = ORIGIN
  jest.clearAllMocks()
  mockUser.mockResolvedValue({ id: 'u1', email: 'a@b.test', name: null })
  mockDeck.mockResolvedValue([])
})

describe('swipe deck request', () => {
  it('keeps a clean keyword and remote flag, drops links and junk ids, keeps the newest skips', () => {
    expect(readDeckRequest({ keyword: '  Product   Manager ', remote: true, skip: ['abc', 'x y', 5, 'def'] })).toEqual({
      filters: { keyword: 'product manager', remote: true },
      skip: ['abc', 'def'],
    })
    expect(readDeckRequest({ keyword: 'visit spam.com', remote: 'yes' }).filters).toEqual({ keyword: undefined, remote: false })
    const many = Array.from({ length: MAX_SKIP_IDS + 20 }, (_, i) => `id${i}`)
    const skip = readDeckRequest({ skip: many }).skip
    expect(skip).toHaveLength(MAX_SKIP_IDS)
    expect(skip.at(-1)).toBe(`id${MAX_SKIP_IDS + 19}`)
    expect(readDeckRequest(null)).toEqual({ filters: { keyword: undefined, remote: false }, skip: [] })
  })
})

describe('swipe card', () => {
  it('shows the company, pay, location and a slug the draft endpoint accepts', () => {
    const card = toSwipeCard({
      id: 'job_123', title: 'Senior Product Manager', company: 'Stripe', companyLogo: null,
      companyRef: { id: 'c1', name: 'Stripe', slug: 'stripe', logoUrl: null, website: 'https://stripe.com' },
      minAnnual: BigInt(190000), maxAnnual: BigInt(240000), currency: 'USD',
      locationRaw: 'Remote, US', countryCode: 'US', remoteMode: 'remote', remote: true,
      createdAt: new Date('2026-11-18T10:00:00Z'),
    } as never)
    expect(card).toMatchObject({ id: 'job_123', title: 'Senior Product Manager', company: 'Stripe', remote: true, listedAt: '2026-11-18T10:00:00.000Z' })
    expect(card.slug).toMatch(/^senior-product-manager-j-/)
    expect(card.logo).toBe('/logo/domain/stripe.com')
    expect(card.salary).toMatch(/190/)
  })
})

describe('deck endpoint', () => {
  it('refuses another origin and anonymous visitors', async () => {
    expect((await postDeck(req({}, 'https://evil.test'))).status).toBe(403)
    mockUser.mockResolvedValue(null)
    expect((await postDeck(req({}))).status).toBe(401)
    expect(mockDeck).not.toHaveBeenCalled()
  })

  it('deals cards for the signed-in user only, with the checked filters', async () => {
    mockDeck.mockResolvedValue([{ id: 'j1' }])
    const res = await postDeck(req({ keyword: 'Data engineer', skip: ['j0'], userId: 'someone-else' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ cards: [{ id: 'j1' }] })
    expect(mockDeck).toHaveBeenCalledWith('u1', { keyword: 'data engineer', remote: false }, ['j0'])
  })
})
