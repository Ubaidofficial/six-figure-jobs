import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'

import { SignInForm } from '@/components/account/SignInForm'
import { accountsEnabled, emailConfigured, googleConfigured } from '@/lib/accounts/enabled'
import { safeCallbackPath } from '@/lib/auth/redirect'
import { getSessionUser } from '@/lib/auth/session'

import styles from '@/components/account/account.module.css'

// Private page: noindex, no canonical, no hreflang. Reading searchParams and the session cookie keeps it dynamic.
export const metadata: Metadata = {
  title: 'Sign in | Six Figure Jobs',
  robots: { index: false, follow: false },
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Per-request, always: a page that 404s at build time would be frozen as a static 404 even after the flag is turned on.
  await connection()
  if (!accountsEnabled()) notFound()
  const params = await searchParams
  const callbackUrl = safeCallbackPath(params.callbackUrl)

  if (await getSessionUser()) redirect(callbackUrl)

  const error = typeof params.error === 'string' ? params.error : undefined
  return (
    <main className={`${styles.page} ${styles.narrow}`}>
      <h1 className={styles.title}>Sign in</h1>
      <p className={styles.lede}>No password. Use Google, or get a one-time sign-in link by email.</p>
      <SignInForm
        google={googleConfigured()}
        email={emailConfigured()}
        callbackUrl={callbackUrl}
        initialError={error}
        sent={params.sent === '1'}
      />
    </main>
  )
}
