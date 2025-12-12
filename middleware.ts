import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')

  // Redirect apex → www (except localhost)
  const hostname = host ? host.split(':')[0] : null
  if (host && hostname === '6figjobs.com' && !host.startsWith('localhost')) {
    const url = request.nextUrl.clone()
    url.host = `www.${host}`
    return NextResponse.redirect(url, 301)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
