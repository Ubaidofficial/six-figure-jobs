// Stripe webhook processing. The route (app/api/billing/webhook/route.ts) passes the RAW request body here; the
// signature is verified against that exact string before anything else happens.
//
// Idempotency: each event id is inserted into StripeEvent inside the same transaction as the work it triggers
// (INSERT ... ON CONFLICT DO NOTHING). A redelivery, or two deliveries racing, finds the row and does nothing; if the
// work throws, the transaction rolls back (event id included) and Stripe retries. Ledger grants also carry their own
// unique idempotency keys, so even a duplicate that slipped past StripeEvent could not double-credit.
//
// Users are found only through User.stripeCustomerId, which this app writes when it creates the customer. Metadata
// on an event is cross-checked against it, never trusted on its own.

import type { Prisma, PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'

import { MAX_CREDITS_PER_GRANT, getMonthlyCredits, isProductKey } from './config'
import { clawbackCredits, grantCredits } from './credits'

type Env = Record<string, string | undefined>
type Tx = Prisma.TransactionClient

export interface WebhookDeps {
  stripe: Pick<Stripe, 'webhooks' | 'invoicePayments'>
  db: Pick<PrismaClient, '$transaction' | 'creditLedger'>
  /** STRIPE_WEBHOOK_SECRET. */
  secret: string
  env?: Env
  /** Receives event id, type and error name only; never payloads, emails or card data. */
  log?: (message: string, meta?: Record<string, string>) => void
}

export type ProcessOutcome = 'processed' | 'duplicate'

export interface WebhookResult {
  status: 200 | 400 | 500
  body: { received?: true; duplicate?: true; error?: string }
}

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === 'string' ? value : (value?.id ?? null)

/** Verify the signature on the raw body, then process the event. Never throws. */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  deps: WebhookDeps,
): Promise<WebhookResult> {
  const log = deps.log ?? ((m, meta) => console.error(`[stripe-webhook] ${m}`, meta ?? {}))
  if (!signature) return { status: 400, body: { error: 'missing signature' } }

  let event: Stripe.Event
  try {
    // Throws on a bad signature, a body that is not the exact bytes Stripe signed, or a timestamp outside tolerance.
    event = deps.stripe.webhooks.constructEvent(rawBody, signature, deps.secret)
  } catch {
    return { status: 400, body: { error: 'invalid signature' } }
  }

  try {
    const outcome = await processStripeEvent(event, deps)
    return { status: 200, body: outcome === 'duplicate' ? { received: true, duplicate: true } : { received: true } }
  } catch (err) {
    // 500 makes Stripe retry with backoff. The transaction rolled back, so nothing is half-applied.
    log('event failed', { id: event.id, type: event.type, error: err instanceof Error ? err.name : 'unknown' })
    return { status: 500, body: { error: 'processing failed' } }
  }
}

/** Process one verified event exactly once. Throws on a failure that Stripe should retry. */
export async function processStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<ProcessOutcome> {
  const env = deps.env ?? process.env
  const log = deps.log ?? ((m, meta) => console.error(`[stripe-webhook] ${m}`, meta ?? {}))

  // Needs the Stripe API, so it is done before the transaction opens.
  const refundInvoiceId = event.type === 'charge.refunded' ? await findRefundedInvoiceId(event, deps) : null

  return deps.db.$transaction(
    async (tx) => {
      const claimed = await tx.stripeEvent.createMany({
        data: [{ id: event.id, type: event.type }],
        skipDuplicates: true,
      })
      if (claimed.count === 0) return 'duplicate' as const

      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          await onCheckoutPaid(tx, event.data.object, log)
          break
        case 'invoice.paid':
          await onInvoicePaid(tx, event.data.object, env, log)
          break
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await onSubscriptionChange(tx, event, log)
          break
        case 'charge.refunded':
          await onChargeRefunded(tx, event.data.object, refundInvoiceId, log)
          break
        default:
          // Subscribed to something this code does not act on: recorded as seen, nothing else.
          break
      }
      return 'processed' as const
    },
    { timeout: 15_000, maxWait: 10_000 },
  )
}

async function userForCustomer(tx: Tx, customer: string | { id: string } | null | undefined) {
  const customerId = idOf(customer)
  if (!customerId) return null
  return tx.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } })
}

/** One-off credit pack paid. Subscriptions are handled by the invoice and subscription events instead. */
async function onCheckoutPaid(tx: Tx, session: Stripe.Checkout.Session, log: NonNullable<WebhookDeps['log']>) {
  if (session.mode !== 'payment') return
  // Delayed payment methods complete the session unpaid; checkout.session.async_payment_succeeded follows if it clears.
  if (session.payment_status !== 'paid') return

  const meta = session.metadata ?? {}
  const credits = Number(meta.credits)
  if (!isProductKey(meta.product) || meta.product === 'subscription') return
  if (!Number.isSafeInteger(credits) || credits <= 0 || credits > MAX_CREDITS_PER_GRANT) {
    log('pack session with unusable credits', { session: session.id })
    return
  }

  const user = await userForCustomer(tx, session.customer)
  if (!user) {
    log('pack session for an unknown customer', { session: session.id })
    return
  }
  const claimedUser = meta.userId ?? session.client_reference_id
  if (claimedUser && claimedUser !== user.id) {
    log('pack session metadata does not match its customer', { session: session.id })
    return
  }

  await grantCredits(tx, {
    userId: user.id,
    credits,
    kind: 'pack',
    reason: `pack:${meta.product}`,
    refId: idOf(session.payment_intent) ?? session.id,
    idempotencyKey: `checkout:${session.id}`,
  })
}

/** A subscription invoice was paid: grant the monthly credits for that period. */
async function onInvoicePaid(tx: Tx, invoice: Stripe.Invoice, env: Env, log: NonNullable<WebhookDeps['log']>) {
  // Renewals and the first invoice only. Mid-period upgrades and manual invoices do not grant again.
  if (invoice.billing_reason !== 'subscription_create' && invoice.billing_reason !== 'subscription_cycle') return
  if (!idOf(invoice.parent?.subscription_details?.subscription)) return

  const credits = getMonthlyCredits(env)
  if (credits <= 0) return

  const user = await userForCustomer(tx, invoice.customer)
  if (!user) {
    log('invoice for an unknown customer', { invoice: invoice.id ?? '' })
    return
  }
  if (!invoice.id) return

  await grantCredits(tx, {
    userId: user.id,
    credits,
    kind: 'subscription_grant',
    reason: 'monthly_credits',
    refId: invoice.id,
    idempotencyKey: `invoice:${invoice.id}`,
  })
}

/** Mirror the subscription. Out-of-order deliveries are ignored: only a newer event overwrites the row. */
async function onSubscriptionChange(
  tx: Tx,
  event: Extract<
    Stripe.Event,
    { type: 'customer.subscription.created' | 'customer.subscription.updated' | 'customer.subscription.deleted' }
  >,
  log: NonNullable<WebhookDeps['log']>,
) {
  const sub = event.data.object
  const customerId = idOf(sub.customer)
  const user = await userForCustomer(tx, sub.customer)
  if (!user || !customerId) {
    log('subscription for an unknown customer', { subscription: sub.id })
    return
  }

  const eventAt = new Date(event.created * 1000)
  const existing = await tx.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } })
  if (existing?.lastEventAt && existing.lastEventAt.getTime() > eventAt.getTime()) return

  const item = sub.items?.data?.[0]
  const data = {
    userId: user.id,
    stripeCustomerId: customerId,
    status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
    priceId: item?.price?.id ?? null,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    lastEventAt: eventAt,
  }
  if (existing) {
    await tx.subscription.update({ where: { stripeSubscriptionId: sub.id }, data })
  } else {
    await tx.subscription.create({ data: { stripeSubscriptionId: sub.id, ...data } })
  }
}

/**
 * A charge was refunded (fully or partly; `amount_refunded` is cumulative). Take back the matching share of the credits
 * that payment granted, capped at what the user still has. Charges that granted nothing are ignored.
 */
async function onChargeRefunded(
  tx: Tx,
  charge: Stripe.Charge,
  invoiceId: string | null,
  log: NonNullable<WebhookDeps['log']>,
) {
  const paymentIntent = idOf(charge.payment_intent)
  if (!paymentIntent || !(charge.amount > 0) || !(charge.amount_refunded > 0)) return

  const grant =
    (await tx.creditLedger.findFirst({ where: { refId: paymentIntent, kind: 'pack' } })) ??
    (invoiceId ? await tx.creditLedger.findFirst({ where: { refId: invoiceId, kind: 'subscription_grant' } }) : null)
  if (!grant || grant.delta <= 0) return

  const target = Math.floor((grant.delta * Math.min(charge.amount_refunded, charge.amount)) / charge.amount)
  const taken = await clawbackCredits(tx, {
    userId: grant.userId,
    refId: grant.refId ?? paymentIntent,
    target,
    reason: 'charge_refunded',
    idempotencyKey: `refund:${charge.id}:${charge.amount_refunded}`,
  })
  if (taken < target) log('refund clawback capped at available balance', { charge: charge.id })
}

/** For a refunded subscription payment, find which invoice it paid (packs are found by payment intent directly). */
async function findRefundedInvoiceId(
  event: Extract<Stripe.Event, { type: 'charge.refunded' }>,
  deps: WebhookDeps,
): Promise<string | null> {
  const paymentIntent = idOf(event.data.object.payment_intent)
  if (!paymentIntent) return null
  const pack = await deps.db.creditLedger.findFirst({ where: { refId: paymentIntent, kind: 'pack' } })
  if (pack) return null
  const found = await deps.stripe.invoicePayments.list({
    payment: { type: 'payment_intent', payment_intent: paymentIntent },
    limit: 1,
  })
  return idOf(found.data[0]?.invoice as string | { id: string } | null | undefined)
}
