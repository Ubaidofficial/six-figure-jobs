import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'

import { AccountView } from '@/components/account/AccountView'
import { accountsEnabled, billingEnabled } from '@/lib/accounts/enabled'
import { getSessionUser } from '@/lib/auth/session'
import { getProducts } from '@/lib/billing/config'
import { loadAccountSummary } from '@/lib/billing/summary'

// Private page: noindex, no canonical, no hreflang. Reading the session cookie keeps it dynamic.
export const metadata: Metadata = {
  title: 'Your account | Six Figure Jobs',
  robots: { index: false, follow: false },
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Per-request, always: a page that 404s at build time would be frozen as a static 404 even after the flag is turned on.
  await connection()
  if (!accountsEnabled()) notFound()
  const user = await getSessionUser()
  if (!user) redirect('/sign-in?callbackUrl=%2Faccount')

  const params = await searchParams
  const summary = await loadAccountSummary(user.id)
  const products = billingEnabled() ? getProducts().map(({ key, credits }) => ({ key, credits })) : []

  return (
    <AccountView
      email={user.email}
      balance={summary.balance}
      subscription={summary.subscription}
      products={products}
      hasBillingAccount={summary.hasBillingAccount}
      checkout={params.checkout === 'success' || params.checkout === 'cancelled' ? params.checkout : undefined}
    />
  )
}
