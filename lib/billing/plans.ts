// What /pricing shows. Amounts and currencies come from Stripe at request time; nothing about price is written in code.

import type Stripe from 'stripe'

import { getLaunchCouponId, getProducts, isSubscriptionKey, type ProductKey } from './config'

/** The launch discount on a subscription plan, as Stripe's coupon defines it. */
export interface PlanDiscount {
  percentOff: number
  /** The price after the discount, "$4.99" style; null if it cannot be worked out. */
  discountedText: string | null
  /** "on your first payment", "for the first 3 months" or "on every payment". */
  duration: string
}

export interface PlanData {
  key: ProductKey
  priceText: string | null
  interval: string | null
  credits: number
  discount: PlanDiscount | null
}

/** Words for how long a coupon lasts, from Stripe's own `duration` fields. */
export function describeCouponDuration(coupon: Pick<Stripe.Coupon, 'duration' | 'duration_in_months'>): string {
  if (coupon.duration === 'forever') return 'on every payment'
  if (coupon.duration === 'repeating' && coupon.duration_in_months) {
    return `for the first ${coupon.duration_in_months === 1 ? 'month' : `${coupon.duration_in_months} months`}`
  }
  return 'on your first payment'
}

/** The launch coupon if one is configured and Stripe says it is usable and a percentage; else null. */
async function loadLaunchCoupon(stripe: Pick<Stripe, 'coupons'>, env: Record<string, string | undefined>) {
  const id = getLaunchCouponId(env)
  if (!id) return null
  try {
    const coupon = await stripe.coupons.retrieve(id)
    return coupon.valid && coupon.percent_off && coupon.percent_off > 0 && coupon.percent_off < 100 ? coupon : null
  } catch {
    return null
  }
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
  stripe: Pick<Stripe, 'prices' | 'coupons'>,
  env: Record<string, string | undefined> = process.env,
): Promise<PlanData[]> {
  const coupon = await loadLaunchCoupon(stripe, env)
  return Promise.all(
    getProducts(env).map(async (product): Promise<PlanData> => {
      try {
        const price = await stripe.prices.retrieve(product.priceId)
        const usable = price.active
        const discounted =
          coupon && usable && isSubscriptionKey(product.key) && price.unit_amount != null
            ? Math.round((price.unit_amount * (100 - (coupon.percent_off ?? 0))) / 100)
            : null
        return {
          key: product.key,
          priceText: usable ? formatStripeAmount(price.unit_amount, price.currency) : null,
          interval: price.recurring?.interval ?? null,
          credits: product.credits,
          discount:
            coupon && discounted != null
              ? {
                  percentOff: coupon.percent_off ?? 0,
                  discountedText: formatStripeAmount(discounted, price.currency),
                  duration: describeCouponDuration(coupon),
                }
              : null,
        }
      } catch {
        return { key: product.key, priceText: null, interval: null, credits: product.credits, discount: null }
      }
    }),
  )
}
