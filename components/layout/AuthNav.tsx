'use client'

import * as React from 'react'
import Link from '@/components/ui/Link'

// Renders nothing unless accounts were switched on when the site was built (next.config.js inlines this from
// lib/accounts/enabled.js), so with accounts off the header HTML is exactly what it was before.
const ENABLED = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === 'true'

// One request per page load, shared by every AuthNav on the page. The header never reads the session on the server (that
// would make every public page dynamic); it asks the session endpoint after load instead.
let pending: Promise<boolean> | null = null
function fetchSignedIn(): Promise<boolean> {
  pending ??= fetch('/api/auth/session', { credentials: 'same-origin', headers: { accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => Boolean(data && data.user))
    .catch(() => false)
  return pending
}

export function AuthNav({ className }: { className?: string }) {
  const [signedIn, setSignedIn] = React.useState(false)

  React.useEffect(() => {
    if (!ENABLED) return
    let live = true
    fetchSignedIn().then((v) => live && setSignedIn(v))
    return () => {
      live = false
    }
  }, [])

  if (!ENABLED) return null
  // The server-rendered HTML is always the static "Sign in" link; it becomes "Account" after the session check.
  return (
    <Link href={signedIn ? '/account' : '/sign-in'} className={className} prefetch={false} rel="nofollow">
      {signedIn ? 'Account' : 'Sign in'}
    </Link>
  )
}
