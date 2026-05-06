import { NextResponse } from 'next/server'
import { checkAdminCredentials, adminUserExists, createSessionToken, sessionCookieOptions } from '../../../../lib/admin/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}))

  const exists = await adminUserExists()
  if (!exists) {
    return NextResponse.json({ error: 'No admin account', setup: true }, { status: 401 })
  }

  if (!username || !password || !(await checkAdminCredentials(username, password))) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const token = createSessionToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
