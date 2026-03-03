import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Total Anthropic jobs
  const total = await prisma.job.count({ where: { company: 'Anthropic' } })
  const active = await prisma.job.count({ where: { company: 'Anthropic', isExpired: false } })
  const expired = await prisma.job.count({ where: { company: 'Anthropic', isExpired: true } })

  __slog(`Anthropic jobs:`)
  __slog(`  Total: ${total}`)
  __slog(`  Active: ${active}`)
  __slog(`  Expired: ${expired}`)

  // Check when last scraped
  const latest = await prisma.job.findFirst({
    where: { company: 'Anthropic' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, title: true }
  })
  __slog(`\nLatest job: ${latest?.title} (${latest?.createdAt})`)

  await prisma.$disconnect()
}
main()
