import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

import { adminUserExists, createAdminUser, sessionTokenFor } from '../../../../lib/admin/auth'
import { COOKIE_NAME, cookieAttrs } from '../../../../lib/admin/session'

export const dynamic = 'force-dynamic'

const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/**
 * Creates the first admin account. Needs ADMIN_SETUP_TOKEN set in the environment and typed into the form: without it,
 * anyone could create an admin while the account table is empty (as it is when the site points at an empty database,
 * which happened twice on 2026-11-13).
 */
export async function POST(req: Request) {
  const setupToken = process.env.ADMIN_SETUP_TOKEN?.trim()
  if (!setupToken) {
    return NextResponse.json({ error: 'Setup is off. Set ADMIN_SETUP_TOKEN in Openship to create the first admin.' }, { status: 403 })
  }
  const exists = await adminUserExists()
  if (exists) {
    return NextResponse.json({ error: 'Admin account already exists', loginInstead: true }, { status: 403 })
  }

  const { username, password, token: given } = await req.json().catch(() => ({}))
  if (typeof given !== 'string' || !sameText(given.trim(), setupToken)) {
    return NextResponse.json({ error: 'Wrong setup token' }, { status: 403 })
  }
  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    return NextResponse.json({ error: 'Username must be at least 2 characters' }, { status: 400 })
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const user = await createAdminUser(username.trim().toLowerCase(), password)

  const token = sessionTokenFor(user)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, cookieAttrs())
  return res
}
