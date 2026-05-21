import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "Job"
    SET "validThrough" = CASE
      WHEN COALESCE("postedAt", "updatedAt", NOW()) + INTERVAL '45 days' > NOW()
        THEN COALESCE("postedAt", "updatedAt", NOW()) + INTERVAL '45 days'
      ELSE NOW() + INTERVAL '45 days'
    END
    WHERE "isExpired" = false
      AND ("validThrough" IS NULL OR "validThrough" <= NOW())
  `)

  console.log(JSON.stringify({ updated: Number(result) }, null, 2))
}

main()
  .catch((error) => {
    console.error('[backfillValidThrough] error:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
