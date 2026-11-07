import { grantCredits } from '@/lib/billing/credits'
import {
  EntitlementError,
  PAST_DUE_GRACE_MS,
  STALE_PERIOD_GRACE_MS,
  hasActiveSubscription,
  requireEntitlement,
} from '@/lib/billing/entitlement'

import { createFakePrisma } from './fakePrisma'

const NOW = new Date('2026-11-06T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function setup() {
  const fake = createFakePrisma()
  fake.addUser('u1')
  const db = fake.prisma as any
  const addSub = (
    status: string,
    currentPeriodEnd: Date | null,
    id = `sub_${fake.tables.subscription.length}`,
    lastEventAt: Date | null = null,
  ) => fake.tables.subscription.push({ id, userId: 'u1', stripeSubscriptionId: id, status, currentPeriodEnd, lastEventAt })
  return { fake, db, addSub }
}

describe('hasActiveSubscription', () => {
  it.each(['active', 'trialing'])('is true for %s with a future period end', async (status) => {
    const { db, addSub } = setup()
    addSub(status, new Date(NOW.getTime() + 10 * DAY))
    expect(await hasActiveSubscription('u1', db, NOW)).toBe(true)
  })

  it.each(['unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused'])('is false for %s', async (status) => {
    const { db, addSub } = setup()
    addSub(status, new Date(NOW.getTime() + 10 * DAY))
    expect(await hasActiveSubscription('u1', db, NOW)).toBe(false)
  })

  describe('past_due (a failed renewal while Stripe retries the card)', () => {
    const wentPastDue = (agoMs: number) => new Date(NOW.getTime() - agoMs)

    it('still counts for the grace period after it went past due', async () => {
      const { db, addSub } = setup()
      addSub('past_due', new Date(NOW.getTime() + 25 * DAY), 'sub_pd', wentPastDue(PAST_DUE_GRACE_MS - 60_000))
      expect(await hasActiveSubscription('u1', db, NOW)).toBe(true)
    })

    it('stops counting once the grace period is over', async () => {
      const { db, addSub } = setup()
      addSub('past_due', new Date(NOW.getTime() + 25 * DAY), 'sub_pd', wentPastDue(PAST_DUE_GRACE_MS + 60_000))
      expect(await hasActiveSubscription('u1', db, NOW)).toBe(false)
    })

    it('does not count when we do not know when it went past due (no free access on missing data)', async () => {
      const { db, addSub } = setup()
      addSub('past_due', new Date(NOW.getTime() + 25 * DAY))
      expect(await hasActiveSubscription('u1', db, NOW)).toBe(false)
    })

    it('does not extend the other bad statuses: unpaid stays out however recent it is', async () => {
      const { db, addSub } = setup()
      addSub('unpaid', new Date(NOW.getTime() + 25 * DAY), 'sub_u', wentPastDue(60_000))
      expect(await hasActiveSubscription('u1', db, NOW)).toBe(false)
    })
  })

  it('is false with no subscription, no user id, or another user\'s subscription', async () => {
    const { db, fake, addSub } = setup()
    expect(await hasActiveSubscription('u1', db, NOW)).toBe(false)
    expect(await hasActiveSubscription('', db, NOW)).toBe(false)
    addSub('active', new Date(NOW.getTime() + DAY))
    fake.tables.subscription[0].userId = 'someone-else'
    expect(await hasActiveSubscription('u1', db, NOW)).toBe(false)
  })

  it('stops once the period ended longer ago than the grace margin (a lost "deleted" webhook cannot grant access forever)', async () => {
    const { db, addSub } = setup()
    addSub('active', new Date(NOW.getTime() - STALE_PERIOD_GRACE_MS - 1000))
    expect(await hasActiveSubscription('u1', db, NOW)).toBe(false)
  })

  it('tolerates a renewal webhook that is a little late', async () => {
    const { db, addSub } = setup()
    addSub('active', new Date(NOW.getTime() - 60 * 60 * 1000))
    expect(await hasActiveSubscription('u1', db, NOW)).toBe(true)
  })

  it('any one active subscription is enough', async () => {
    const { db, addSub } = setup()
    addSub('canceled', new Date(NOW.getTime() + DAY), 'sub_old')
    addSub('active', new Date(NOW.getTime() + DAY), 'sub_new')
    expect(await hasActiveSubscription('u1', db, NOW)).toBe(true)
  })
})

describe('requireEntitlement', () => {
  const credit = (fake: ReturnType<typeof createFakePrisma>, n: number) =>
    (fake.prisma as any).$transaction((tx: any) =>
      grantCredits(tx, { userId: 'u1', credits: n, kind: 'pack', reason: 'r', refId: 'pi', idempotencyKey: `k${n}` }),
    )

  it('answers 401 when nobody is signed in', async () => {
    const { db } = setup()
    for (const id of [null, undefined, '']) {
      await expect(requireEntitlement(id, { subscription: true }, db)).rejects.toMatchObject({
        code: 'unauthenticated',
        status: 401,
      })
    }
  })

  it('answers 402 subscription_required without a subscription', async () => {
    const { db } = setup()
    await expect(requireEntitlement('u1', { subscription: true }, db)).rejects.toMatchObject({
      code: 'subscription_required',
      status: 402,
    })
  })

  it('passes with an active subscription', async () => {
    const { db, addSub } = setup()
    addSub('active', new Date(Date.now() + DAY))
    await expect(requireEntitlement('u1', { subscription: true }, db)).resolves.toBeUndefined()
  })

  it('answers 402 insufficient_credits below the minimum, passes at or above it', async () => {
    const { db, fake } = setup()
    await credit(fake, 5)
    await expect(requireEntitlement('u1', { minCredits: 6 }, db)).rejects.toBeInstanceOf(EntitlementError)
    await expect(requireEntitlement('u1', { minCredits: 5 }, db)).resolves.toBeUndefined()
  })

  it('needs every requirement', async () => {
    const { db, fake } = setup()
    await credit(fake, 5)
    await expect(requireEntitlement('u1', { subscription: true, minCredits: 1 }, db)).rejects.toMatchObject({
      code: 'subscription_required',
    })
  })

  it('asks for nothing when there is no requirement', async () => {
    const { db } = setup()
    await expect(requireEntitlement('u1', {}, db)).resolves.toBeUndefined()
  })
})
