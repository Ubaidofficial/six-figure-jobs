// Starting a purchase and opening the customer portal. Both work for an already-authenticated user id supplied by the
// route; nothing here trusts anything the browser sends except which product button was pressed.

import type { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'

import { getProduct, type ProductKey } from './config'
import { hasActiveSubscription } from './entitlement'

import { getSiteUrl } from '@/lib/seo/site'

export class BillingError extends Error {
  constructor(
    readonly code: 'product_unavailable' | 'already_subscribed' | 'no_billing_account' | 'user_not_found' | 'stripe_error',
    readonly status: 400 | 404 | 409 | 502,
  ) {
    super(code)
    this.name = 'BillingError'
  }
}

interface Deps {
  stripe: Pick<Stripe, 'customers' | 'checkout' | 'billingPortal'>
  db: Pick<PrismaClient, 'user' | 'subscription'>
  env?: Record<string, string | undefined>
  siteUrl?: string
}

/** The user's Stripe customer id, creating the customer (once) if they have none yet. Never stores an email we did not get from sign-in. */
export async function ensureStripeCustomer(userId: string, deps: Deps): Promise<string> {
  const user = await deps.db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  })
  if (!user) throw new BillingError('user_not_found', 404)
  if (user.stripeCustomerId) return user.stripeCustomerId

  // The idempotency key makes two simultaneous first checkouts get the same Stripe customer back.
  const customer = await deps.stripe.customers.create(
    { email: user.email ?? undefined, name: user.name ?? undefined, metadata: { userId: user.id } },
    { idempotencyKey: `customer:${user.id}` },
  )
  // Only fills an empty column; if another request won the race, re-read and use theirs.
  await deps.db.user.updateMany({ where: { id: user.id, stripeCustomerId: null }, data: { stripeCustomerId: customer.id } })
  const stored = await deps.db.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } })
  return stored?.stripeCustomerId ?? customer.id
}

/** Create a Checkout Session for a configured product and return its hosted URL. */
export async function createCheckoutUrl(userId: string, productKey: ProductKey, deps: Deps): Promise<string> {
  const env = deps.env ?? process.env
  const product = getProduct(productKey, env)
  if (!product) throw new BillingError('product_unavailable', 400)

  if (product.mode === 'subscription' && (await hasActiveSubscription(userId, deps.db))) {
    throw new BillingError('already_subscribed', 409)
  }

  const customer = await ensureStripeCustomer(userId, deps)
  const siteUrl = deps.siteUrl ?? getSiteUrl()
  // Metadata is written here, server side, and read back only from a signature-verified webhook event.
  const metadata = { userId, product: product.key, credits: String(product.credits) }

  try {
    const session = await deps.stripe.checkout.sessions.create({
      mode: product.mode,
      customer,
      client_reference_id: userId,
      line_items: [{ price: product.priceId, quantity: 1 }],
      metadata,
      ...(product.mode === 'subscription'
        ? { subscription_data: { metadata: { userId } } }
        : { payment_intent_data: { metadata } }),
      success_url: `${siteUrl}/account?checkout=success`,
      cancel_url: `${siteUrl}/account?checkout=cancelled`,
    })
    if (!session.url) throw new Error('no url')
    return session.url
  } catch {
    throw new BillingError('stripe_error', 502)
  }
}

/** Create a customer-portal session (manage card, cancel, invoices) for a user who already has a Stripe customer. */
export async function createPortalUrl(userId: string, deps: Deps): Promise<string> {
  const user = await deps.db.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } })
  if (!user) throw new BillingError('user_not_found', 404)
  if (!user.stripeCustomerId) throw new BillingError('no_billing_account', 409)
  try {
    const session = await deps.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${deps.siteUrl ?? getSiteUrl()}/account`,
    })
    return session.url
  } catch {
    throw new BillingError('stripe_error', 502)
  }
}
