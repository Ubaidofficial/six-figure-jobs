// scripts/verify-sitemap-job-urls.ts
// Verifies that a list of /job/... URLs resolve to DB rows (by shortId).

import { prisma } from '../lib/prisma'

function extractShortIdFromJobUrl(url: string): string | null {
  const u = String(url || '').trim()
  if (!u) return null
  const m = u.match(/\/job\/[^/?#]+-j-([a-z0-9]{5,12})(?:[/?#]|$)/i)
  return m?.[1] ? m[1].toLowerCase() : null
}

async function main() {
  const file = process.env.URL_FILE || '.tmp_audit/gsc_urls.txt'
  const fs = await import('node:fs/promises')
  const raw = await fs.readFile(file, 'utf8')
  const urls = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let ok = 0
  let missing = 0

  for (const url of urls) {
    const shortId = extractShortIdFromJobUrl(url)
    if (!shortId) {
      console.log(`bad_url\t${url}`)
      missing++
      continue
    }

    const job = await prisma.job.findUnique({
      where: { shortId },
      select: { id: true, isExpired: true, title: true, createdAt: true, updatedAt: true },
    })

    if (!job) {
      console.log(`missing_db\tshortId=${shortId}\t${url}`)
      missing++
      continue
    }

    ok++
    console.log(
      `ok\tshortId=${shortId}\tisExpired=${job.isExpired}\tid=${job.id}\tupdatedAt=${job.updatedAt.toISOString()}\t${url}`,
    )
  }

  console.log(`\nsummary\tok=${ok}\tmissing=${missing}\ttotal=${urls.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

