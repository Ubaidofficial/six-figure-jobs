import { NextResponse } from 'next/server'
import { checkAdminPassword, createSessionToken, sessionCookieOptions } from '../../../../lib/admin/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}))
  if (!password || !checkAdminPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }
  const token = createSessionToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
