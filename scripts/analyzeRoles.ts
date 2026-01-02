import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function analyzeRoles() {
  const roles = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: {
      isExpired: false,
      isHighSalary: true,
      roleSlug: { not: null },
    },
    _count: true,
    orderBy: { _count: { roleSlug: 'desc' } },
    take: 50,
  })

  __slog('\n📊 TOP 50 ROLES:\n')
  roles.forEach((role, i) => {
    __slog(`${i + 1}. ${role.roleSlug} (${role._count} jobs)`)
  })
}

analyzeRoles()
  .catch(console.error)
  .finally(() => prisma.$disconnect())