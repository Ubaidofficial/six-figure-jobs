import Link from '@/components/ui/Link'

import type { PlanData } from '@/lib/billing/plans'

import { CheckoutButton } from './BillingButtons'
import { PlanComparison, type SiteNumbers } from './PlanComparison'

import styles from './account.module.css'

export type Plan = PlanData

const NAMES: Record<Plan['key'], string> = {
  subscription_weekly: 'Pro, weekly',
  subscription: 'Pro, monthly',
  pack_small: 'Small credit pack',
  pack_large: 'Large credit pack',
}

const isPlan = (key: Plan['key']) => key === 'subscription' || key === 'subscription_weekly'
const ORDER: Plan['key'][] = ['subscription_weekly', 'subscription', 'pack_small', 'pack_large']

export function PlansView({
  plans,
  signedIn,
  subscribed,
  numbers = null,
  instantAlerts = false,
}: {
  plans: Plan[]
  signedIn: boolean
  subscribed: boolean
  numbers?: SiteNumbers | null
  instantAlerts?: boolean
}) {
  const ordered = [...plans].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Plans</h1>
      <p className={styles.lede}>Prices are read from our payment provider when this page loads.</p>

      {ordered.length === 0 ? (
        <p className={styles.banner}>Plans are not available yet.</p>
      ) : (
        <div className={styles.plans}>
          {ordered.map((plan) => (
            <section key={plan.key} className={styles.plan} aria-label={NAMES[plan.key]}>
              <h2 className={styles.planName}>{NAMES[plan.key]}</h2>
              <p className={styles.price}>
                {plan.discount?.discountedText ? (
                  <>
                    <s className={styles.struck}>{plan.priceText}</s> {plan.discount.discountedText}
                  </>
                ) : (
                  (plan.priceText ?? 'Unavailable')
                )}
                {plan.interval ? <span className={styles.per}> / {plan.interval}</span> : null}
              </p>
              {plan.discount ? (
                <p className={styles.muted}>
                  {plan.discount.percentOff}% off {plan.discount.duration}
                </p>
              ) : null}
              <p className={styles.muted}>
                {plan.credits.toLocaleString('en-US')} credits{plan.interval ? ` each ${plan.interval}` : ''}
              </p>
              <div className={styles.planCta}>
                {!signedIn ? (
                  <Link
                    href={`/sign-in?callbackUrl=${encodeURIComponent('/pricing')}`}
                    rel="nofollow"
                    className={styles.link}
                  >
                    Sign in to continue
                  </Link>
                ) : isPlan(plan.key) && subscribed ? (
                  <p className={styles.muted}>You are subscribed.</p>
                ) : (
                  <CheckoutButton product={plan.key} variant={isPlan(plan.key) ? 'primary' : 'tertiary'}>
                    {isPlan(plan.key) ? 'Subscribe' : 'Buy credits'}
                  </CheckoutButton>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {ordered.length > 0 ? <PlanComparison plans={ordered} numbers={numbers} instantAlerts={instantAlerts} /> : null}
    </main>
  )
}
