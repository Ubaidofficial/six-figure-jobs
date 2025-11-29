import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Total Anthropic jobs
  const total = await prisma.job.count({ where: { company: 'Anthropic' } })
  const active = await prisma.job.count({ where: { company: 'Anthropic', isExpired: false } })
  const expired = await prisma.job.count({ where: { company: 'Anthropic', isExpired: true } })

  console.log(`Anthropic jobs:`)
  console.log(`  Total: ${total}`)
  console.log(`  Active: ${active}`)
  console.log(`  Expired: ${expired}`)

  // Check when last scraped
  const latest = await prisma.job.findFirst({
    where: { company: 'Anthropic' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, title: true }
  })
  console.log(`\nLatest job: ${latest?.title} (${latest?.createdAt})`)

  await prisma.$disconnect()
}
main()
