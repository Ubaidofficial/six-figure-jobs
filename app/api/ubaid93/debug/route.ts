// Temporary diagnostic endpoint — remove after login confirmed working
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result: Record<string, unknown> = {}

  // Check if AdminUser table exists
  try {
    const count = await prisma.adminUser.count()
    result.adminUserCount = count

    if (count > 0) {
      const users = await prisma.adminUser.findMany({
        select: { username: true, createdAt: true },
      })
      result.users = users
    }
  } catch (err) {
    result.adminUserError = String(err)
  }

  // Check migrations applied
  try {
    const migrations = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null; logs: string | null }[]>`
      SELECT migration_name, finished_at, logs
      FROM "_prisma_migrations"
      WHERE migration_name LIKE '%admin%' OR migration_name LIKE '%error%' OR migration_name LIKE '%feedback%'
      ORDER BY finished_at DESC
    `
    result.recentMigrations = migrations
  } catch (err) {
    result.migrationsError = String(err)
  }

  return NextResponse.json(result, { status: 200 })
}
