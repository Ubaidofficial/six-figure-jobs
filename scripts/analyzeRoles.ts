import { prisma } from '../lib/prisma'

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

  console.log('\n📊 TOP 50 ROLES:\n')
  roles.forEach((role, i) => {
    console.log(`${i + 1}. ${role.roleSlug} (${role._count} jobs)`)
  })
}

analyzeRoles()
  .catch(console.error)
  .finally(() => prisma.$disconnect())