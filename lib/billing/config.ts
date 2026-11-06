// Billing configuration, all from env. No price, currency or credit amount is a product decision made in code:
// Stripe price ids and the credit amounts come from the environment, and what a price costs is read from Stripe.

type Env = Record<string, string | undefined>

export type ProductKey = 'subscription' | 'pack_small' | 'pack_large'

export interface Product {
  key: ProductKey
  /** Stripe Checkout mode. */
  mode: 'subscription' | 'payment'
  priceId: string
  /** Credits granted per purchase (pack) or per paid billing period (subscription). */
  credits: number
}

/**
 * PLACEHOLDERS. Used only when the matching env var is unset, so the code runs in development. The owner must set
 * BILLING_MONTHLY_CREDITS, BILLING_PACK_SMALL_CREDITS and BILLING_PACK_LARGE_CREDITS before launch
 * (docs/billing-launch-checklist.md); these numbers are not a product decision.
 */
export const PLACEHOLDER_CREDITS = { monthly: 100, packSmall: 50, packLarge: 250 } as const

/** Sanity ceiling for one grant; anything above is treated as a misconfiguration, not honoured. */
export const MAX_CREDITS_PER_GRANT = 1_000_000

const PRODUCT_ENV: Record<ProductKey, { price: string; credits: string; fallback: number; mode: Product['mode'] }> = {
  subscription: {
    price: 'STRIPE_PRICE_SUBSCRIPTION',
    credits: 'BILLING_MONTHLY_CREDITS',
    fallback: PLACEHOLDER_CREDITS.monthly,
    mode: 'subscription',
  },
  pack_small: {
    price: 'STRIPE_PRICE_PACK_SMALL',
    credits: 'BILLING_PACK_SMALL_CREDITS',
    fallback: PLACEHOLDER_CREDITS.packSmall,
    mode: 'payment',
  },
  pack_large: {
    price: 'STRIPE_PRICE_PACK_LARGE',
    credits: 'BILLING_PACK_LARGE_CREDITS',
    fallback: PLACEHOLDER_CREDITS.packLarge,
    mode: 'payment',
  },
}

export const PRODUCT_KEYS = Object.keys(PRODUCT_ENV) as ProductKey[]

export function isProductKey(value: unknown): value is ProductKey {
  return typeof value === 'string' && (PRODUCT_KEYS as string[]).includes(value)
}

/** A whole number from 0 to MAX_CREDITS_PER_GRANT, or the fallback when unset or malformed. */
export function parseCredits(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > MAX_CREDITS_PER_GRANT) return fallback
  return n
}

/** Credits per paid subscription period (BILLING_MONTHLY_CREDITS). */
export function getMonthlyCredits(env: Env = process.env): number {
  return parseCredits(env[PRODUCT_ENV.subscription.credits], PRODUCT_ENV.subscription.fallback)
}

/** One product, or null when its Stripe price id is not configured. */
export function getProduct(key: ProductKey, env: Env = process.env): Product | null {
  const spec = PRODUCT_ENV[key]
  const priceId = env[spec.price]?.trim()
  if (!priceId) return null
  return { key, mode: spec.mode, priceId, credits: parseCredits(env[spec.credits], spec.fallback) }
}

/** Every product that has a price id configured. */
export function getProducts(env: Env = process.env): Product[] {
  return PRODUCT_KEYS.map((key) => getProduct(key, env)).filter((p): p is Product => p !== null)
}
