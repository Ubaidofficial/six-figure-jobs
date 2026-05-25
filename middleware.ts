import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// NOTE: Node.js crypto (createHmac, createHash) is NOT available in Edge Runtime.
// The middleware only checks cookie *existence* — a fast gate for the common case
// (no cookie = definitely not logged in → redirect immediately).
// Actual HMAC verification happens in the server-side layout (Node.js runtime)
// via getAdminSession(), which runs for every dashboard page render.

const ADMIN_ROOT = '/ubaid93'
const PUBLIC_PATHS = [`${ADMIN_ROOT}/login`, `${ADMIN_ROOT}/setup`]

// Canonical host — ensure apex redirects to www for consistent PageRank consolidation
const WWW_HOST = 'www.6figjobs.com'
const APEX_HOST = '6figjobs.com'
const LEGACY_ROLE_QUERY_KEYS = ['seniority', 'skill', 'tech'] as const

function normalizeLegacyRoleQuery(request: NextRequest): NextResponse | null {
  const url = request.nextUrl.clone()
  if (!url.pathname.startsWith('/jobs/')) return null

  const segments = url.pathname.split('/').filter(Boolean)
  // Only normalize legacy query params on /jobs/:role routes.
  if (segments.length !== 2) return null

  let changed = false
  for (const key of LEGACY_ROLE_QUERY_KEYS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  }

  if (!changed) return null
  return NextResponse.redirect(url, { status: 308 })
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''

  // 301 apex → www (SEO: consolidate PageRank on canonical www host)
  if (host === APEX_HOST) {
    const url = request.nextUrl.clone()
    url.host = WWW_HOST
    return NextResponse.redirect(url, { status: 301 })
  }

  const normalizedRoleQueryRedirect = normalizeLegacyRoleQuery(request)
  if (normalizedRoleQueryRedirect) return normalizedRoleQueryRedirect

  const { pathname } = request.nextUrl

  if (!pathname.startsWith(ADMIN_ROOT)) return NextResponse.next()
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next()

  const token = request.cookies.get('admin_session')?.value
  if (!token) {
    return NextResponse.redirect(new URL(`${ADMIN_ROOT}/login`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)).*)',
  ],
}
