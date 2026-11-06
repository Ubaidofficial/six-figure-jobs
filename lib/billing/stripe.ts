import Stripe from 'stripe'

let client: Stripe | null = null

/**
 * Lazily built Stripe client. Never called at import time, so the build and every public page work with no secret set.
 * The SDK's own pinned API version is used on purpose: create the webhook endpoint with the same version
 * (docs/billing-launch-checklist.md) so event payloads match the types this code was written against.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  if (!client) client = new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 })
  return client
}
