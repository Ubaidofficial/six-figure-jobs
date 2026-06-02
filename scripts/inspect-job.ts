import { prisma } from '../lib/prisma'

async function main() {
  const job = await prisma.job.findFirst({
    where: { shortId: 'kmbu4' },
    select: { id: true, title: true, isExpired: true, shortId: true, updatedAt: true, createdAt: true, postedAt: true, externalId: true, lastSeenAt: true }
  })
  console.log('Job:', job)
}
main().catch(console.error)
