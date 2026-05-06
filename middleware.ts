import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from './lib/admin/session'

const ADMIN_ROOT = '/ubaid93'
const PUBLIC_PATHS = [`${ADMIN_ROOT}/login`, `${ADMIN_ROOT}/setup`]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith(ADMIN_ROOT)) return NextResponse.next()
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next()

  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.redirect(new URL(`${ADMIN_ROOT}/login`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/ubaid93/:path*'],
}
