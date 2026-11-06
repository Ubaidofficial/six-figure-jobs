'use client'

import * as React from 'react'
import { signIn, signOut } from 'next-auth/react'

import { Button } from '@/components/ui/button'

import styles from './account.module.css'

const ERRORS: Record<string, string> = {
  RateLimited: 'Too many sign-in emails requested. Wait about 15 minutes and try again.',
  Verification: 'That sign-in link has expired or was already used. Request a new one.',
  AccessDenied: 'Sign-in was not allowed for that account.',
  OAuthAccountNotLinked: 'That email is already registered with a different sign-in method.',
}
const GENERIC_ERROR = 'Sign-in did not work. Please try again.'

export const errorMessage = (code?: string | null) => (code ? (ERRORS[code] ?? GENERIC_ERROR) : null)

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.17.28-1.71V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3 2.34C4.67 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

export function SignInForm({
  google,
  email: emailEnabled,
  callbackUrl,
  initialError,
  sent,
}: {
  google: boolean
  email: boolean
  callbackUrl: string
  initialError?: string
  sent?: boolean
}) {
  const [email, setEmail] = React.useState('')
  const [busy, setBusy] = React.useState<'google' | 'email' | null>(null)
  const [error, setError] = React.useState<string | null>(errorMessage(initialError))
  const [done, setDone] = React.useState(Boolean(sent))

  const withGoogle = async () => {
    setBusy('google')
    setError(null)
    try {
      await signIn('google', { callbackUrl })
    } catch {
      setError(GENERIC_ERROR)
      setBusy(null)
    }
  }

  const withEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('email')
    setError(null)
    try {
      const res = await signIn('nodemailer', { email: email.trim(), callbackUrl, redirect: false })
      if (res?.error) setError(errorMessage(res.error))
      else setDone(true)
    } catch {
      setError(GENERIC_ERROR)
    }
    setBusy(null)
  }

  if (done) {
    return (
      <div className={`${styles.banner} ${styles.bannerOk}`} role="status">
        <strong>Check your email.</strong> We sent a sign-in link. It works once and expires in 15 minutes.
      </div>
    )
  }

  return (
    <div className={styles.card}>
      {error ? (
        <p role="alert" className={`${styles.banner} ${styles.bannerError} ${styles.bannerFlush}`}>
          {error}
        </p>
      ) : null}

      {google ? (
        <Button variant="secondary" size="lg" className={styles.google} loading={busy === 'google'} onClick={withGoogle} icon={<GoogleMark />}>
          Continue with Google
        </Button>
      ) : null}

      {google && emailEnabled ? <div className={styles.divider}>or</div> : null}

      {emailEnabled ? (
        <form onSubmit={withEmail} className={`${styles.stack} ${styles.stackFlush}`}>
          <div className={styles.field}>
            <label htmlFor="signin-email" className={styles.label}>
              Email address
            </label>
            <input
              id="signin-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={320}
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" size="lg" className={styles.fullWidth} loading={busy === 'email'}>
            Email me a sign-in link
          </Button>
        </form>
      ) : null}

      {!google && !emailEnabled ? <p className={styles.muted}>Sign-in is not available right now.</p> : null}
    </div>
  )
}

export function SignOutButton() {
  const [busy, setBusy] = React.useState(false)
  return (
    <Button
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true)
        await signOut({ callbackUrl: '/' })
      }}
    >
      Sign out
    </Button>
  )
}
