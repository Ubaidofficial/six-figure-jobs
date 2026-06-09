import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkJobAvailability } from './lib/jobs/jobAvailabilityCheck'

// Runs in the Node.js runtime so we can call Prisma directly (e.g. for the
// /job/:slug 410 check below). The previous edge-only setup couldn't tell Google
// the difference between a removed job (410) and an unknown URL (404), which
// caused the "Not found (404)" pile-up in Google Search Console — Google
// retries 404s for weeks but drops 410s immediately.
export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)).*)',
  ],
}

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

const ALLOWED_PUBLIC_QUERY_PARAMS = new Set(['page', 'q', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'gclid', 'fbclid'])

function enforceQueryAllowlist(request: NextRequest): NextResponse | null {
  const url = request.nextUrl.clone()
  
  if (request.method !== 'GET') return null
  if (!url.pathname.startsWith('/jobs')) return null

  let changed = false
  const keysToDelete: string[] = []

  url.searchParams.forEach((_, key) => {
    if (!ALLOWED_PUBLIC_QUERY_PARAMS.has(key)) {
      keysToDelete.push(key)
    }
  })

  if (keysToDelete.length > 0) {
    keysToDelete.forEach((key) => url.searchParams.delete(key))
    return NextResponse.redirect(url, { status: 301 })
  }

  return null
}

function buildGoneResponse(): NextResponse {
  // Minimal 410 body — Google reads the status, not the HTML. Keeping the body
  // small avoids wasting bandwidth and prevents accidental indexing.
  return new NextResponse(
    '<!doctype html><title>Gone</title>This job posting is no longer available.',
    {
      status: 410,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400',
        'X-Robots-Tag': 'noindex',
      },
    },
  )
}

async function handleJobDetailStatus(request: NextRequest): Promise<NextResponse | null> {
  const match = request.nextUrl.pathname.match(/^\/job\/([^/]+)\/?$/)
  if (!match) return null

  try {
    const availability = await checkJobAvailability(match[1])
    if (availability === 'expired' || availability === 'stale') {
      return buildGoneResponse()
    }
  } catch (err) {
    // Don't break the request if the lookup fails — the page route will fall
    // back to its own DB query and 404 path. We just lose the 410 upgrade.
    console.error('[middleware] job availability check failed', err)
  }
  return null
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''

  // 301 apex → www (SEO: consolidate PageRank on canonical www host)
  if (host === APEX_HOST) {
    const url = request.nextUrl.clone()
    url.host = WWW_HOST
    return NextResponse.redirect(url, { status: 301 })
  }

  const goneResponse = await handleJobDetailStatus(request)
  if (goneResponse) return goneResponse

  const normalizedRoleQueryRedirect = normalizeLegacyRoleQuery(request)
  if (normalizedRoleQueryRedirect) return normalizedRoleQueryRedirect

  const { pathname } = request.nextUrl

  if (!pathname.startsWith(ADMIN_ROOT)) {
    const queryEnforcement = enforceQueryAllowlist(request)
    if (queryEnforcement) return queryEnforcement
    return NextResponse.next()
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('admin_session')?.value
  if (!token) {
    return NextResponse.redirect(new URL(`${ADMIN_ROOT}/login`, request.url))
  }

  return NextResponse.next()
}
