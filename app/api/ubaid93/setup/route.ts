import { NextResponse } from 'next/server'
import { adminUserExists, createAdminUser, createSessionToken } from '../../../../lib/admin/auth'
import { COOKIE_NAME, cookieAttrs } from '../../../../lib/admin/session'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const exists = await adminUserExists()
  if (exists) {
    return NextResponse.json({ error: 'Admin account already exists', loginInstead: true }, { status: 403 })
  }

  const { username, password } = await req.json().catch(() => ({}))
  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    return NextResponse.json({ error: 'Username must be at least 2 characters' }, { status: 400 })
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  await createAdminUser(username.trim().toLowerCase(), password)

  const token = createSessionToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, cookieAttrs())
  return res
}
