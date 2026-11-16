import Link from '@/components/ui/Link'
import type { ProductKey } from '@/lib/billing/config'

import { CheckoutButton, PortalButton } from './BillingButtons'
import { SignOutButton } from './SignInForm'

import styles from './account.module.css'

export interface AccountViewProps {
  email: string | null
  balance: number
  subscription: { active: boolean; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean }
  /** Products with a Stripe price configured; empty when billing is not set up. */
  products: { key: ProductKey; credits: number }[]
  hasBillingAccount: boolean
  checkout?: 'success' | 'cancelled'
}

const formatDate = (d: Date) => d.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

export function AccountView({ email, balance, subscription, products, hasBillingAccount, checkout }: AccountViewProps) {
  const isPlan = (key: ProductKey) => key === 'subscription' || key === 'subscription_weekly'
  const plans = products.filter((p) => isPlan(p.key))
  const packs = products.filter((p) => !isPlan(p.key))

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Your account</h1>
      <p className={styles.lede}>{email ? `Signed in as ${email}.` : 'You are signed in.'}</p>

      {checkout === 'success' ? (
        <p role="status" className={`${styles.banner} ${styles.bannerOk}`}>
          Payment received. Your plan and credits update within a minute; refresh this page if they have not changed yet.
        </p>
      ) : null}
      {checkout === 'cancelled' ? (
        <p role="status" className={styles.banner}>
          Checkout was cancelled. You have not been charged.
        </p>
      ) : null}

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="plan-heading">
          <h2 id="plan-heading" className={styles.cardTitle}>
            Plan
          </h2>
          <p className={styles.big}>{subscription.active ? 'Subscriber' : 'Free'}</p>
          <p className={styles.muted}>
            {subscription.active && subscription.currentPeriodEnd
              ? subscription.cancelAtPeriodEnd
                ? `Ends on ${formatDate(subscription.currentPeriodEnd)}. It will not renew.`
                : `Renews on ${formatDate(subscription.currentPeriodEnd)}.`
              : 'No active subscription.'}
          </p>
        </section>

        <section className={styles.card} aria-labelledby="credits-heading">
          <h2 id="credits-heading" className={styles.cardTitle}>
            Credit balance
          </h2>
          <p className={styles.big}>{balance.toLocaleString('en-US')}</p>
          <p className={styles.muted}>Credits are added after each successful payment.</p>
        </section>
      </div>

      <section className={styles.card} aria-labelledby="applications-heading">
        <h2 id="applications-heading" className={styles.cardTitle}>
          Applications
        </h2>
        <p className={styles.muted}>Your résumé, cover letters for the jobs you pick, and a tracker for where you applied.</p>
        <Link href="/account/applications" className={styles.link}>
          Open your applications
        </Link>
      </section>

      <section className={styles.card} aria-labelledby="billing-heading">
        <h2 id="billing-heading" className={styles.cardTitle}>
          Billing
        </h2>
        {products.length === 0 && !hasBillingAccount ? (
          <p className={styles.muted}>Billing is not available yet.</p>
        ) : (
          <div className={styles.actions}>
            {!subscription.active
              ? plans.map((p) => (
                  <CheckoutButton key={p.key} product={p.key}>
                    {p.key === 'subscription_weekly' ? 'Subscribe weekly' : 'Subscribe monthly'}: {p.credits.toLocaleString('en-US')} credits a{' '}
                    {p.key === 'subscription_weekly' ? 'week' : 'month'}
                  </CheckoutButton>
                ))
              : null}
            {packs.map((p) => (
              <CheckoutButton key={p.key} product={p.key} variant="tertiary">
                Buy {p.credits.toLocaleString('en-US')} credits
              </CheckoutButton>
            ))}
            {hasBillingAccount ? <PortalButton>Manage billing</PortalButton> : null}
          </div>
        )}
        <Link href="/pricing" className={styles.link}>
          See plans and compare prices
        </Link>
      </section>

      <div className={styles.actions}>
        <SignOutButton />
      </div>
    </main>
  )
}
