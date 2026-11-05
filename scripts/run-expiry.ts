// scripts/run-expiry.ts
// Expires jobs not refreshed in 7 days (lib/jobs/expiry.ts). Run after the daily freehire sync so jobs
// freehire has stopped returning drop off the site. Expired jobs return 404 and leave the sitemap.
import { prisma } from '../lib/prisma'
import { runExpiryCycle } from '../lib/jobs/expiry'

runExpiryCycle()
  .then(({ expired }) => console.log(`expired ${expired} jobs not refreshed in 7 days`))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
