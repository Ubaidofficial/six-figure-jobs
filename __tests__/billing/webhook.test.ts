import Stripe from 'stripe'

import { handleStripeWebhook, processStripeEvent, type WebhookDeps } from '@/lib/billing/webhook'

import { createFakePrisma } from './fakePrisma'

const SECRET = 'unit-test-webhook-secret'
const stripe = new Stripe('unit-test-key')

function setup(env: Record<string, string> = {}) {
  const fake = createFakePrisma()
  fake.addUser('u1', { stripeCustomerId: 'cus_1' })
  fake.addUser('u2', { stripeCustomerId: 'cus_2' })
  const list = jest.fn()
  const log = jest.fn()
  const deps: WebhookDeps = {
    stripe: { webhooks: stripe.webhooks, invoicePayments: { list } } as any,
    db: fake.prisma as any,
    secret: SECRET,
    env: { BILLING_MONTHLY_CREDITS: '100', ...env },
    log,
  }
  return { fake, deps, list, log }
}

let n = 0
const event = (type: string, object: Record<string, any>, created = 1_800_000_000) =>
  ({ id: `evt_${++n}`, object: 'event', type, created, data: { object } }) as any

/** Sign exactly as Stripe does, over the raw body string. */
function post(deps: WebhookDeps, evt: any, opts: { secret?: string; body?: string; header?: string | null } = {}) {
  const body = opts.body ?? JSON.stringify(evt)
  const header =
    opts.header === undefined
      ? stripe.webhooks.generateTestHeaderString({ payload: body, secret: opts.secret ?? SECRET })
      : opts.header
  return handleStripeWebhook(body, header, deps)
}

const packSession = (over: Record<string, any> = {}) => ({
  id: 'cs_1',
  object: 'checkout.session',
  mode: 'payment',
  payment_status: 'paid',
  customer: 'cus_1',
  client_reference_id: 'u1',
  payment_intent: 'pi_1',
  metadata: { userId: 'u1', product: 'pack_small', credits: '50' },
  ...over,
})

const invoice = (over: Record<string, any> = {}) => ({
  id: 'in_1',
  object: 'invoice',
  customer: 'cus_1',
  billing_reason: 'subscription_cycle',
  parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1' } },
  ...over,
})

const subscription = (over: Record<string, any> = {}) => ({
  id: 'sub_1',
  object: 'subscription',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: false,
  items: { data: [{ price: { id: 'price_sub' }, current_period_end: 1_900_000_000 }] },
  ...over,
})

describe('signature verification', () => {
  it('rejects a missing signature header with 400 and does nothing', async () => {
    const { fake, deps } = setup()
    const res = await post(deps, event('checkout.session.completed', packSession()), { header: null })
    expect(res.status).toBe(400)
    expect(fake.tables.stripeEvent).toHaveLength(0)
    expect(fake.tables.creditLedger).toHaveLength(0)
  })

  it('rejects a signature made with the wrong secret', async () => {
    const { fake, deps } = setup()
    const res = await post(deps, event('checkout.session.completed', packSession()), { secret: 'someone-elses-secret' })
    expect(res).toEqual({ status: 400, body: { error: 'invalid signature' } })
    expect(fake.tables.creditLedger).toHaveLength(0)
  })

  it('rejects a body that was changed after signing (verification is over the raw bytes)', async () => {
    const { fake, deps } = setup()
    const evt = event('checkout.session.completed', packSession())
    const signed = JSON.stringify(evt)
    const header = stripe.webhooks.generateTestHeaderString({ payload: signed, secret: SECRET })
    const tampered = signed.replace('"credits":"50"', '"credits":"5000"')
    expect(tampered).not.toBe(signed)
    const res = await handleStripeWebhook(tampered, header, deps)
    expect(res.status).toBe(400)
    expect(fake.tables.creditLedger).toHaveLength(0)
  })

  it('rejects re-serialised JSON (different whitespace) even though the content is equal', async () => {
    const { deps } = setup()
    const evt = event('checkout.session.completed', packSession())
    const header = stripe.webhooks.generateTestHeaderString({ payload: JSON.stringify(evt), secret: SECRET })
    const res = await handleStripeWebhook(JSON.stringify(evt, null, 2), header, deps)
    expect(res.status).toBe(400)
  })

  it('rejects a stale timestamp (replay of an old signed request)', async () => {
    const { deps } = setup()
    const evt = event('checkout.session.completed', packSession())
    const body = JSON.stringify(evt)
    const header = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    })
    expect((await handleStripeWebhook(body, header, deps)).status).toBe(400)
  })

  it('accepts a correctly signed event', async () => {
    const { deps } = setup()
    expect((await post(deps, event('checkout.session.completed', packSession()))).status).toBe(200)
  })
})

describe('idempotency', () => {
  it('delivering the same event twice grants credits once', async () => {
    const { fake, deps } = setup()
    const evt = event('checkout.session.completed', packSession())
    expect(await post(deps, evt)).toEqual({ status: 200, body: { received: true } })
    expect(await post(deps, evt)).toEqual({ status: 200, body: { received: true, duplicate: true } })
    expect(fake.balance('u1')).toBe(50)
    expect(fake.tables.stripeEvent).toHaveLength(1)
  })

  it('simultaneous deliveries of the same event grant once', async () => {
    const { fake, deps } = setup()
    const evt = event('checkout.session.completed', packSession())
    const results = await Promise.all([post(deps, evt), post(deps, evt), post(deps, evt)])
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(fake.balance('u1')).toBe(50)
  })

  it('a different event for the same checkout session still cannot double-grant (ledger key)', async () => {
    const { fake, deps } = setup()
    await post(deps, event('checkout.session.completed', packSession()))
    await post(deps, event('checkout.session.async_payment_succeeded', packSession()))
    expect(fake.balance('u1')).toBe(50)
  })

  it('a failure rolls everything back, including the event id, so Stripe\'s retry is processed', async () => {
    const { fake, deps, log } = setup()
    const evt = event('checkout.session.completed', packSession())
    // Fail inside the transaction after the event id was recorded.
    const original = fake.prisma.$transaction.bind(fake.prisma)
    let failOnce = true
    ;(deps.db as any) = {
      ...fake.prisma,
      $transaction: (fn: any, o: any) =>
        original((tx: any) => {
          const wrapped = {
            ...tx,
            creditLedger: {
              ...tx.creditLedger,
              create: async (a: any) => {
                if (failOnce) {
                  failOnce = false
                  throw new Error('database went away')
                }
                return tx.creditLedger.create(a)
              },
            },
          }
          return fn(wrapped)
        }, o),
    }
    const first = await post(deps, evt)
    expect(first.status).toBe(500)
    expect(fake.tables.stripeEvent).toHaveLength(0)
    expect(fake.tables.creditLedger).toHaveLength(0)
    expect(log).toHaveBeenCalledWith('event failed', expect.objectContaining({ id: evt.id }))

    const retry = await post(deps, evt)
    expect(retry.status).toBe(200)
    expect(fake.balance('u1')).toBe(50)
  })

  it('never logs payload contents', async () => {
    const { deps, log } = setup()
    const evt = event('checkout.session.completed', packSession({ customer: 'cus_unknown' }))
    await post(deps, evt)
    const logged = JSON.stringify(log.mock.calls)
    expect(logged).not.toMatch(/@|card|4242/)
  })
})

describe('checkout.session.completed (credit packs)', () => {
  it('grants the credits named in our own metadata to the customer\'s user', async () => {
    const { fake, deps } = setup()
    await post(deps, event('checkout.session.completed', packSession()))
    expect(fake.tables.creditLedger).toEqual([
      expect.objectContaining({ userId: 'u1', delta: 50, kind: 'pack', refId: 'pi_1', idempotencyKey: 'checkout:cs_1' }),
    ])
  })

  it('does nothing while payment is unpaid, then grants on async_payment_succeeded', async () => {
    const { fake, deps } = setup()
    await post(deps, event('checkout.session.completed', packSession({ payment_status: 'unpaid' })))
    expect(fake.balance('u1')).toBe(0)
    await post(deps, event('checkout.session.async_payment_succeeded', packSession({ payment_status: 'paid' })))
    expect(fake.balance('u1')).toBe(50)
  })

  it('ignores subscription-mode sessions (the invoice event grants those)', async () => {
    const { fake, deps } = setup()
    await post(deps, event('checkout.session.completed', packSession({ mode: 'subscription' })))
    expect(fake.balance('u1')).toBe(0)
  })

  it('ignores a session whose metadata names a different user than its Stripe customer', async () => {
    const { fake, deps } = setup()
    await post(deps, event('checkout.session.completed', packSession({ metadata: { userId: 'u2', product: 'pack_small', credits: '50' } })))
    expect(fake.balance('u1')).toBe(0)
    expect(fake.balance('u2')).toBe(0)
  })

  it('ignores an unknown customer, an unknown product and unusable credit amounts', async () => {
    const { fake, deps } = setup()
    await post(deps, event('checkout.session.completed', packSession({ id: 'cs_a', customer: 'cus_nobody' })))
    await post(deps, event('checkout.session.completed', packSession({ id: 'cs_b', metadata: { userId: 'u1', product: 'free_money', credits: '50' } })))
    await post(deps, event('checkout.session.completed', packSession({ id: 'cs_c', metadata: { userId: 'u1', product: 'pack_small', credits: '-5' } })))
    await post(deps, event('checkout.session.completed', packSession({ id: 'cs_d', metadata: { userId: 'u1', product: 'pack_small', credits: '99999999' } })))
    await post(deps, event('checkout.session.completed', packSession({ id: 'cs_e', metadata: { userId: 'u1', product: 'subscription', credits: '50' } })))
    expect(fake.tables.creditLedger).toHaveLength(0)
  })
})

describe('invoice.paid (monthly credits)', () => {
  it('grants BILLING_MONTHLY_CREDITS for the first invoice and for renewals', async () => {
    const { fake, deps } = setup({ BILLING_MONTHLY_CREDITS: '120' })
    await post(deps, event('invoice.paid', invoice({ id: 'in_1', billing_reason: 'subscription_create' })))
    await post(deps, event('invoice.paid', invoice({ id: 'in_2', billing_reason: 'subscription_cycle' })))
    expect(fake.balance('u1')).toBe(240)
    expect(fake.tables.creditLedger.map((r) => r.kind)).toEqual(['subscription_grant', 'subscription_grant'])
  })

  it('does not grant for mid-period updates, manual invoices or invoices without a subscription', async () => {
    const { fake, deps } = setup()
    await post(deps, event('invoice.paid', invoice({ id: 'in_a', billing_reason: 'subscription_update' })))
    await post(deps, event('invoice.paid', invoice({ id: 'in_b', billing_reason: 'manual' })))
    await post(deps, event('invoice.paid', invoice({ id: 'in_c', parent: null })))
    expect(fake.balance('u1')).toBe(0)
  })

  it('ignores an invoice for a customer that is not one of ours', async () => {
    const { fake, deps } = setup()
    expect((await post(deps, event('invoice.paid', invoice({ customer: 'cus_stranger' })))).status).toBe(200)
    expect(fake.tables.creditLedger).toHaveLength(0)
  })

  it('grants nothing when the monthly amount is configured as 0', async () => {
    const { fake, deps } = setup({ BILLING_MONTHLY_CREDITS: '0' })
    await post(deps, event('invoice.paid', invoice()))
    expect(fake.tables.creditLedger).toHaveLength(0)
  })
})

describe('subscription mirror', () => {
  it('creates, updates and cancels the mirror row', async () => {
    const { fake, deps } = setup()
    await post(deps, event('customer.subscription.created', subscription(), 1000))
    expect(fake.tables.subscription[0]).toMatchObject({
      userId: 'u1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      status: 'active',
      priceId: 'price_sub',
      cancelAtPeriodEnd: false,
    })
    expect(fake.tables.subscription[0].currentPeriodEnd).toEqual(new Date(1_900_000_000 * 1000))

    await post(deps, event('customer.subscription.updated', subscription({ cancel_at_period_end: true }), 2000))
    expect(fake.tables.subscription).toHaveLength(1)
    expect(fake.tables.subscription[0].cancelAtPeriodEnd).toBe(true)

    await post(deps, event('customer.subscription.deleted', subscription({ status: 'active' }), 3000))
    expect(fake.tables.subscription[0].status).toBe('canceled')
  })

  it('ignores an older event that arrives after a newer one', async () => {
    const { fake, deps } = setup()
    await post(deps, event('customer.subscription.updated', subscription({ status: 'past_due' }), 5000))
    await post(deps, event('customer.subscription.updated', subscription({ status: 'active' }), 4000))
    expect(fake.tables.subscription[0].status).toBe('past_due')
  })

  it('ignores a subscription whose customer is not one of ours', async () => {
    const { fake, deps } = setup()
    await post(deps, event('customer.subscription.created', subscription({ customer: 'cus_stranger' })))
    expect(fake.tables.subscription).toHaveLength(0)
  })

  it('accepts an expanded customer object as well as an id', async () => {
    const { fake, deps } = setup()
    await post(deps, event('customer.subscription.created', subscription({ customer: { id: 'cus_2' } })))
    expect(fake.tables.subscription[0].userId).toBe('u2')
  })
})

describe('charge.refunded', () => {
  const charge = (over: Record<string, any> = {}) => ({
    id: 'ch_1',
    object: 'charge',
    amount: 1000,
    amount_refunded: 1000,
    payment_intent: 'pi_1',
    customer: 'cus_1',
    ...over,
  })

  it('claws back a full refund of a pack', async () => {
    const { fake, deps } = setup()
    await post(deps, event('checkout.session.completed', packSession()))
    await post(deps, event('charge.refunded', charge()))
    expect(fake.balance('u1')).toBe(0)
    expect(fake.tables.creditLedger.at(-1)).toMatchObject({ kind: 'refund', delta: -50, refId: 'pi_1' })
  })

  it('claws back proportionally for a partial refund, then the rest for the final one', async () => {
    const { fake, deps } = setup()
    await post(deps, event('checkout.session.completed', packSession()))
    await post(deps, event('charge.refunded', charge({ amount_refunded: 400 })))
    expect(fake.balance('u1')).toBe(30) // 40% of 50 = 20 taken
    await post(deps, event('charge.refunded', charge({ amount_refunded: 1000 })))
    expect(fake.balance('u1')).toBe(0) // cumulative 100% = 50, 20 already taken
  })

  it('never takes the balance below zero when the credits were already spent', async () => {
    const { fake, deps } = setup()
    await post(deps, event('checkout.session.completed', packSession()))
    // The user spent 45 of the 50 credits before the refund.
    await (deps.db as any).$transaction(async (tx: any) => {
      await tx.creditLedger.create({ data: { userId: 'u1', delta: -45, kind: 'spend', reason: 'x', idempotencyKey: 'spent' } })
    })
    await post(deps, event('charge.refunded', charge()))
    expect(fake.balance('u1')).toBe(0)
  })

  it('claws back a refunded subscription payment by finding the invoice through Stripe', async () => {
    const { fake, deps, list } = setup({ BILLING_MONTHLY_CREDITS: '100' })
    await post(deps, event('invoice.paid', invoice({ id: 'in_9' })))
    list.mockResolvedValue({ data: [{ invoice: 'in_9' }] })
    await post(deps, event('charge.refunded', charge({ payment_intent: 'pi_sub', amount: 2900, amount_refunded: 2900 })))
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ payment: { type: 'payment_intent', payment_intent: 'pi_sub' } }))
    expect(fake.balance('u1')).toBe(0)
  })

  it('ignores a refund of a payment that granted nothing', async () => {
    const { fake, deps, list } = setup()
    list.mockResolvedValue({ data: [] })
    await post(deps, event('charge.refunded', charge({ payment_intent: 'pi_unrelated' })))
    expect(fake.tables.creditLedger).toHaveLength(0)
  })

  it('answers 500 (so Stripe retries) if the invoice lookup fails', async () => {
    const { deps, list } = setup()
    list.mockRejectedValue(new Error('stripe is down'))
    expect((await post(deps, event('charge.refunded', charge({ payment_intent: 'pi_x' })))).status).toBe(500)
  })
})

describe('other events', () => {
  it('records an unhandled event type as seen and changes nothing', async () => {
    const { fake, deps } = setup()
    const out = await processStripeEvent(event('customer.created', { id: 'cus_9' }), deps)
    expect(out).toBe('processed')
    expect(fake.tables.stripeEvent).toHaveLength(1)
    expect(fake.tables.creditLedger).toHaveLength(0)
  })
})
