import { NextResponse } from 'next/server'
import { checkAdminCredentials, adminUserExists, createSessionToken } from '../../../../lib/admin/auth'
import { COOKIE_NAME, cookieAttrs } from '../../../../lib/admin/session'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
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
    res.cookies.set(COOKIE_NAME, token, cookieAttrs())
    return res
  } catch (err) {
    console.error('[admin login] error:', err)
    return NextResponse.json({ error: 'Server error — check deploy logs' }, { status: 500 })
  }
}
