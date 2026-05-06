import { NextResponse } from 'next/server'
import { COOKIE_NAME, cookieAttrs } from '../../../../lib/admin/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', { ...cookieAttrs(), maxAge: 0 })
  return res
}
