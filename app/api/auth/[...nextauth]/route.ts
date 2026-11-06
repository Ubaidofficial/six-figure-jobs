// Auth.js endpoints (/api/auth/session, /csrf, /providers, /signin/*, /callback/*, /signout). Answers 404 unless
// accounts are enabled, and loads nothing (not next-auth, not Prisma) until that check has passed.
import type { NextRequest } from 'next/server'

import { accountsEnabled, notFoundResponse } from '@/lib/accounts/enabled'

export async function GET(req: NextRequest) {
  if (!accountsEnabled()) return notFoundResponse()
  const { handlers } = await import('@/lib/auth')
  return handlers.GET(req)
}

export async function POST(req: NextRequest) {
  if (!accountsEnabled()) return notFoundResponse()
  const { rateLimitMagicLink } = await import('@/lib/auth/signInRateLimit')
  const limited = await rateLimitMagicLink(req)
  if (limited) return limited
  const { handlers } = await import('@/lib/auth')
  return handlers.POST(req)
}

// Methods this route does not serve answer 404 (not 405), so a disabled or unused route looks like any missing path.
export {
  notFoundResponse as PUT,
  notFoundResponse as PATCH,
  notFoundResponse as DELETE,
  notFoundResponse as OPTIONS,
}
