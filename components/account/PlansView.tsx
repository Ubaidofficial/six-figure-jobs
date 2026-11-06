import Link from 'next/link'

import { CheckoutButton } from './BillingButtons'

import styles from './account.module.css'

export interface Plan {
  key: 'subscription' | 'pack_small' | 'pack_large'
  /** Formatted from Stripe price data at request time, for example "$29.00"; null if Stripe could not be reached. */
  priceText: string | null
  /** "month", "year" ... for a recurring price; null for a one-off pack. */
  interval: string | null
  credits: number
}

const NAMES: Record<Plan['key'], string> = {
  subscription: 'Subscription',
  pack_small: 'Small credit pack',
  pack_large: 'Large credit pack',
}

export function PlansView({
  plans,
  signedIn,
  subscribed,
}: {
  plans: Plan[]
  signedIn: boolean
  subscribed: boolean
}) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Plans</h1>
      <p className={styles.lede}>Prices are read from our payment provider when this page loads.</p>

      {plans.length === 0 ? (
        <p className={styles.banner}>Plans are not available yet.</p>
      ) : (
        <div className={styles.plans}>
          {plans.map((plan) => (
            <section key={plan.key} className={styles.plan} aria-label={NAMES[plan.key]}>
              <h2 className={styles.planName}>{NAMES[plan.key]}</h2>
              <p className={styles.price}>
                {plan.priceText ?? 'Unavailable'}
                {plan.interval ? <span className={styles.per}> / {plan.interval}</span> : null}
              </p>
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
                ) : plan.key === 'subscription' && subscribed ? (
                  <p className={styles.muted}>You are subscribed.</p>
                ) : (
                  <CheckoutButton product={plan.key} variant={plan.key === 'subscription' ? 'primary' : 'tertiary'}>
                    {plan.key === 'subscription' ? 'Subscribe' : 'Buy credits'}
                  </CheckoutButton>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
