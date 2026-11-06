import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'

import { PlansView } from '@/components/account/PlansView'
import { accountsEnabled, billingEnabled } from '@/lib/accounts/enabled'

// Accounts off (the default): /pricing is the same static redirect to /jobs it has always been. Accounts on: a
// noindex plan page rendered per request, so the numbers are whatever Stripe says right now.
export const metadata: Metadata = {
  title: 'Plans | Six Figure Jobs',
  robots: { index: false, follow: false },
}

export default async function PricingPage() {
  if (!accountsEnabled()) redirect('/jobs')
  // Opts this page out of build-time prerendering, which would freeze the Stripe prices into the HTML.
  await connection()

  const [{ getSessionUser }, { getStripe }, { loadPlans }, { hasActiveSubscription }] = await Promise.all([
    import('@/lib/auth/session'),
    import('@/lib/billing/stripe'),
    import('@/lib/billing/plans'),
    import('@/lib/billing/entitlement'),
  ])
  const user = await getSessionUser()
  const plans = billingEnabled() ? await loadPlans(getStripe()) : []
  const subscribed = user ? await hasActiveSubscription(user.id) : false
  return <PlansView plans={plans} signedIn={Boolean(user)} subscribed={subscribed} />
}
