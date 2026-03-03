import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Count jobs by source
  const sources = await prisma.job.groupBy({
    by: ['source'],
    _count: true,
    where: { isExpired: false },
    orderBy: { _count: { source: 'desc' } }
  })

  __slog('Jobs by source:')
  __slog('=' .repeat(50))
  sources.forEach(s => {
    __slog(`  ${s.source || 'unknown'}: ${s._count}`)
  })

  const total = sources.reduce((sum, s) => sum + s._count, 0)
  __slog(`\nTotal active jobs: ${total}`)

  await prisma.$disconnect()
}
main()
