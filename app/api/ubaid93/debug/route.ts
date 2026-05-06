// Temporary diagnostic endpoint — shows admin account state without exposing secrets
// Protected by CRON_SECRET. Remove this file after login is confirmed working.
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const users = await prisma.adminUser.findMany({
      select: { id: true, username: true, createdAt: true, passwordHash: true },
    })
    return NextResponse.json({
      count: users.length,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        createdAt: u.createdAt,
        hashPrefix: u.passwordHash.slice(0, 40) + '…',
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
