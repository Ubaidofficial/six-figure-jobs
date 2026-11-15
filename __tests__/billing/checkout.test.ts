import { BillingError, createCheckoutUrl, createPortalUrl, ensureStripeCustomer } from '@/lib/billing/checkout'
import { PLACEHOLDER_CREDITS, getMonthlyCredits, getProduct, getProducts, parseCredits } from '@/lib/billing/config'
import { formatStripeAmount, loadPlans } from '@/lib/billing/plans'

import { createFakePrisma } from './fakePrisma'

const ENV = {
  STRIPE_PRICE_SUBSCRIPTION: 'price_sub',
  STRIPE_PRICE_PACK_SMALL: 'price_small',
  STRIPE_PRICE_PACK_LARGE: 'price_large',
  BILLING_MONTHLY_CREDITS: '120',
  BILLING_PACK_SMALL_CREDITS: '60',
  BILLING_PACK_LARGE_CREDITS: '300',
}

function setup(env: Record<string, string> = ENV) {
  const fake = createFakePrisma()
  fake.addUser('u1', { email: 'person@example.test' })
  const stripe = {
    customers: { create: jest.fn().mockResolvedValue({ id: 'cus_new' }) },
    checkout: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/x' }) } },
    billingPortal: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/p/session/x' }) } },
  }
  const deps = { stripe: stripe as any, db: fake.prisma as any, env, siteUrl: 'https://www.6figjobs.com' }
  return { fake, stripe, deps }
}

describe('billing config', () => {
  it('reads price ids and credit amounts from env, and only offers products with a price id', () => {
    expect(getProducts(ENV).map((p) => [p.key, p.priceId, p.credits])).toEqual([
      ['subscription', 'price_sub', 120],
      ['pack_small', 'price_small', 60],
      ['pack_large', 'price_large', 300],
    ])
    expect(getProducts({})).toEqual([])
    expect(getProduct('pack_large', { STRIPE_PRICE_PACK_SMALL: 'x' })).toBeNull()
  })

  it('falls back to the documented placeholders only when a credit amount is unset or malformed', () => {
    expect(getMonthlyCredits({})).toBe(PLACEHOLDER_CREDITS.monthly)
    expect(getMonthlyCredits({ BILLING_MONTHLY_CREDITS: 'lots' })).toBe(PLACEHOLDER_CREDITS.monthly)
    expect(getMonthlyCredits({ BILLING_MONTHLY_CREDITS: '-4' })).toBe(PLACEHOLDER_CREDITS.monthly)
    expect(parseCredits('250', 1)).toBe(250)
    expect(parseCredits('0', 1)).toBe(0)
  })
})

describe('ensureStripeCustomer', () => {
  it('creates the customer once, stores its id and reuses it', async () => {
    const { fake, stripe, deps } = setup()
    expect(await ensureStripeCustomer('u1', deps)).toBe('cus_new')
    expect(await ensureStripeCustomer('u1', deps)).toBe('cus_new')
    expect(stripe.customers.create).toHaveBeenCalledTimes(1)
    expect(stripe.customers.create).toHaveBeenCalledWith(expect.anything(), { idempotencyKey: 'customer:u1' })
    expect(fake.tables.user[0].stripeCustomerId).toBe('cus_new')
  })

  it('uses the id another request stored first if two race', async () => {
    const { fake, stripe, deps } = setup()
    stripe.customers.create.mockImplementation(async () => {
      fake.tables.user[0].stripeCustomerId = 'cus_winner'
      return { id: 'cus_loser' }
    })
    expect(await ensureStripeCustomer('u1', deps)).toBe('cus_winner')
  })

  it('fails for an unknown user', async () => {
    const { deps } = setup()
    await expect(ensureStripeCustomer('ghost', deps)).rejects.toMatchObject({ code: 'user_not_found' })
  })
})

describe('createCheckoutUrl', () => {
  it('builds a subscription session from env: price id, mode, server-written metadata, absolute return URLs', async () => {
    const { stripe, deps } = setup()
    expect(await createCheckoutUrl('u1', 'subscription', deps)).toBe('https://checkout.stripe.com/c/pay/x')
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_new',
        client_reference_id: 'u1',
        line_items: [{ price: 'price_sub', quantity: 1 }],
        metadata: { userId: 'u1', product: 'subscription', credits: '120' },
        success_url: 'https://www.6figjobs.com/account?checkout=success',
        cancel_url: 'https://www.6figjobs.com/account?checkout=cancelled',
      }),
    )
  })

  it('creates subscriptions in flexible billing mode, and packs without any subscription settings', async () => {
    const { stripe, deps } = setup()
    await createCheckoutUrl('u1', 'subscription', deps)
    expect(stripe.checkout.sessions.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ subscription_data: { metadata: { userId: 'u1', product: 'subscription' }, billing_mode: { type: 'flexible' } } }),
    )
    await createCheckoutUrl('u1', 'pack_small', deps)
    expect((stripe.checkout.sessions.create as jest.Mock).mock.calls.at(-1)![0]).not.toHaveProperty('subscription_data')
  })

  it('builds a one-off payment session for a pack with the credits fixed at purchase time', async () => {
    const { stripe, deps } = setup()
    await createCheckoutUrl('u1', 'pack_large', deps)
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: [{ price: 'price_large', quantity: 1 }],
        metadata: { userId: 'u1', product: 'pack_large', credits: '300' },
        payment_intent_data: { metadata: { userId: 'u1', product: 'pack_large', credits: '300' } },
      }),
    )
  })

  it('refuses a product with no configured price without calling Stripe', async () => {
    const { stripe, deps } = setup({})
    await expect(createCheckoutUrl('u1', 'pack_small', deps)).rejects.toMatchObject({ code: 'product_unavailable', status: 400 })
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('refuses a second subscription (409) but still sells packs to subscribers', async () => {
    const { fake, stripe, deps } = setup()
    fake.tables.subscription.push({
      id: 's',
      userId: 'u1',
      stripeSubscriptionId: 'sub_1',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    })
    await expect(createCheckoutUrl('u1', 'subscription', deps)).rejects.toMatchObject({ code: 'already_subscribed', status: 409 })
    await expect(createCheckoutUrl('u1', 'pack_small', deps)).resolves.toContain('stripe.com')
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1)
  })

  it('turns any Stripe failure into a generic 502 that carries no Stripe message', async () => {
    const { stripe, deps } = setup()
    stripe.checkout.sessions.create.mockRejectedValue(new Error('No such price: price_sub for person@example.test'))
    const err = await createCheckoutUrl('u1', 'subscription', deps).catch((e) => e)
    expect(err).toBeInstanceOf(BillingError)
    expect(err).toMatchObject({ code: 'stripe_error', status: 502, message: 'stripe_error' })
  })
})

describe('createPortalUrl', () => {
  it('needs an existing Stripe customer', async () => {
    const { deps } = setup()
    await expect(createPortalUrl('u1', deps)).rejects.toMatchObject({ code: 'no_billing_account', status: 409 })
  })

  it('opens the portal for the stored customer and returns to /account', async () => {
    const { fake, stripe, deps } = setup()
    fake.tables.user[0].stripeCustomerId = 'cus_9'
    expect(await createPortalUrl('u1', deps)).toBe('https://billing.stripe.com/p/session/x')
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_9',
      return_url: 'https://www.6figjobs.com/account',
    })
  })
})

describe('plans (pricing page data)', () => {
  it('formats amounts from Stripe minor units, honouring zero-decimal currencies', () => {
    expect(formatStripeAmount(2900, 'usd')).toBe('$29.00')
    expect(formatStripeAmount(5000, 'jpy')).toBe('¥5,000')
    expect(formatStripeAmount(null, 'usd')).toBeNull()
    expect(formatStripeAmount(100, 'not-a-currency')).toBeNull()
  })

  it('reads every price from Stripe, and shows a price Stripe cannot return as unavailable instead of guessing', async () => {
    const prices = {
      retrieve: jest.fn(async (id: string) => {
        if (id === 'price_large') throw new Error('boom')
        return { active: true, unit_amount: id === 'price_sub' ? 1900 : 700, currency: 'usd', recurring: id === 'price_sub' ? { interval: 'month' } : null }
      }),
    }
    const plans = await loadPlans({ prices } as any, ENV)
    expect(plans).toEqual([
      { key: 'subscription', priceText: '$19.00', interval: 'month', credits: 120, discount: null },
      { key: 'pack_small', priceText: '$7.00', interval: null, credits: 60, discount: null },
      { key: 'pack_large', priceText: null, interval: null, credits: 300, discount: null },
    ])
    expect(prices.retrieve).toHaveBeenCalledTimes(3)
  })
})

describe('weekly plan and launch discount', () => {
  const WEEKLY_ENV = { ...ENV, STRIPE_PRICE_SUBSCRIPTION_WEEKLY: 'price_week', BILLING_WEEKLY_CREDITS: '30' }

  it('is its own subscription product with its own credits, and does not change the monthly one', () => {
    expect(getProduct('subscription_weekly', WEEKLY_ENV)).toMatchObject({ mode: 'subscription', priceId: 'price_week', credits: 30 })
    expect(getProduct('subscription_weekly', ENV)).toBeNull()
    expect(getProduct('subscription', WEEKLY_ENV)).toMatchObject({ priceId: 'price_sub', credits: 120 })
  })

  it('writes the plan onto the subscription so each invoice can be told apart', async () => {
    const { stripe, deps } = setup(WEEKLY_ENV)
    await createCheckoutUrl('u1', 'subscription_weekly', deps)
    expect(stripe.checkout.sessions.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_week', quantity: 1 }],
        subscription_data: { metadata: { userId: 'u1', product: 'subscription_weekly' }, billing_mode: { type: 'flexible' } },
      }),
    )
  })

  it('applies the launch coupon to subscriptions only, and only when one is configured', async () => {
    const { stripe, deps } = setup({ ...WEEKLY_ENV, BILLING_LAUNCH_COUPON_ID: 'LAUNCH50' })
    await createCheckoutUrl('u1', 'subscription', deps)
    expect(stripe.checkout.sessions.create).toHaveBeenLastCalledWith(expect.objectContaining({ discounts: [{ coupon: 'LAUNCH50' }] }))
    await createCheckoutUrl('u1', 'pack_small', deps)
    expect((stripe.checkout.sessions.create as jest.Mock).mock.calls.at(-1)![0]).not.toHaveProperty('discounts')
    const plain = setup(WEEKLY_ENV)
    await createCheckoutUrl('u1', 'subscription', plain.deps)
    expect((plain.stripe.checkout.sessions.create as jest.Mock).mock.calls.at(-1)![0]).not.toHaveProperty('discounts')
  })
})

describe('loadPlans with a launch discount', () => {
  const env = { ...ENV, STRIPE_PRICE_SUBSCRIPTION_WEEKLY: 'price_week', BILLING_LAUNCH_COUPON_ID: 'LAUNCH50' }
  const prices: Record<string, any> = {
    price_week: { active: true, unit_amount: 499, currency: 'usd', recurring: { interval: 'week' } },
    price_sub: { active: true, unit_amount: 999, currency: 'usd', recurring: { interval: 'month' } },
    price_small: { active: true, unit_amount: 500, currency: 'usd', recurring: null },
    price_large: { active: true, unit_amount: 1500, currency: 'usd', recurring: null },
  }
  const stripeWith = (coupon: any) => ({
    prices: { retrieve: jest.fn(async (id: string) => prices[id]) },
    coupons: { retrieve: jest.fn(async () => coupon) },
  })

  it('shows the Stripe coupon on subscriptions only, with the discounted price worked out from it', async () => {
    const plans = await loadPlans(stripeWith({ valid: true, percent_off: 50, duration: 'once', duration_in_months: null }) as any, env)
    const byKey = Object.fromEntries(plans.map((p) => [p.key, p]))
    expect(byKey.subscription_weekly.discount).toEqual({ percentOff: 50, discountedText: '$2.50', duration: 'on your first payment' })
    expect(byKey.subscription.discount).toMatchObject({ discountedText: '$5.00' })
    expect(byKey.pack_small.discount).toBeNull()
    expect(byKey.subscription_weekly.interval).toBe('week')
  })

  it('words a repeating and a forever coupon from Stripe\'s own fields', async () => {
    const repeating = await loadPlans(stripeWith({ valid: true, percent_off: 50, duration: 'repeating', duration_in_months: 3 }) as any, env)
    expect(repeating[0].discount?.duration).toBe('for the first 3 months')
    const forever = await loadPlans(stripeWith({ valid: true, percent_off: 50, duration: 'forever', duration_in_months: null }) as any, env)
    expect(forever[0].discount?.duration).toBe('on every payment')
  })

  it('shows no discount when the coupon is expired, missing, a fixed amount, or unreadable', async () => {
    for (const coupon of [{ valid: false, percent_off: 50, duration: 'once' }, { valid: true, percent_off: null, duration: 'once' }]) {
      expect((await loadPlans(stripeWith(coupon) as any, env)).every((p) => p.discount === null)).toBe(true)
    }
    const broken = { ...stripeWith(null), coupons: { retrieve: jest.fn().mockRejectedValue(new Error('no such coupon')) } }
    expect((await loadPlans(broken as any, env)).every((p) => p.discount === null)).toBe(true)
  })
})
