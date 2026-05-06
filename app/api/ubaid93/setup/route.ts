import { NextResponse } from 'next/server'
import { adminUserExists, createAdminUser, createSessionToken, sessionCookieOptions } from '../../../../lib/admin/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Only allow setup if no admin exists yet
  const exists = await adminUserExists()
  if (exists) {
    return NextResponse.json({ error: 'Admin account already exists' }, { status: 403 })
  }

  const { username, password } = await req.json().catch(() => ({}))
  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    return NextResponse.json({ error: 'Username must be at least 2 characters' }, { status: 400 })
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  await createAdminUser(username.trim().toLowerCase(), password)

  // Auto-login after account creation
  const token = createSessionToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
