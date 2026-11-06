// What /pricing shows. Amounts and currencies come from Stripe at request time; nothing about price is written in code.

import type Stripe from 'stripe'

import { getProducts } from './config'

export interface PlanData {
  key: 'subscription' | 'pack_small' | 'pack_large'
  priceText: string | null
  interval: string | null
  credits: number
}

/** "$29.00" from Stripe's smallest-unit amount, honouring currencies with no minor unit (JPY) or three (KWD). */
export function formatStripeAmount(unitAmount: number | null, currency: string): string | null {
  if (unitAmount == null) return null
  try {
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() })
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2
    return fmt.format(unitAmount / 10 ** digits)
  } catch {
    return null
  }
}

/** One entry per configured product. A price Stripe cannot return is shown as unavailable rather than guessed. */
export async function loadPlans(
  stripe: Pick<Stripe, 'prices'>,
  env: Record<string, string | undefined> = process.env,
): Promise<PlanData[]> {
  return Promise.all(
    getProducts(env).map(async (product): Promise<PlanData> => {
      try {
        const price = await stripe.prices.retrieve(product.priceId)
        return {
          key: product.key,
          priceText: price.active ? formatStripeAmount(price.unit_amount, price.currency) : null,
          interval: price.recurring?.interval ?? null,
          credits: product.credits,
        }
      } catch {
        return { key: product.key, priceText: null, interval: null, credits: product.credits }
      }
    }),
  )
}
