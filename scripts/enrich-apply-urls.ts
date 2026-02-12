// scripts/enrich-apply-urls.ts
// Extracts direct apply URLs from job board aggregator pages

import { format as __format } from 'node:util'
import puppeteer from 'puppeteer'
import { PrismaClient } from '@prisma/client'
import { extractApplyDestination, extractApplyDestinationFromHtml } from '../lib/scrapers/utils/extractApplyLink'
import { isExternalToHost } from '../lib/scrapers/utils/detectATS'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

const BATCH_SIZE = 50
const DELAY_BETWEEN_REQUESTS = 2000 // 2 seconds

const BOARD_HOSTS: Record<string, string> = {
  remoteok: 'remoteok.com',
  remotive: 'remotive.com',
  himalayas: 'himalayas.app',
  remoteleaf: 'remoteleaf.com',
  weworkremotely: 'weworkremotely.com',
  remoterocketship: 'remoterocketship.com',
  remoteotter: 'remoteotter.com',
  trawle: 'trawle.com',
  '4dayweek': '4dayweek.io',
  builtin: 'builtin.com',
  dice: 'dice.com',
  wellfound: 'wellfound.com',
  otta: 'otta.com',
  ycombinator: 'ycombinator.com',
  remote100k: 'remote100k.com',
  realworkfromanywhere: 'realworkfromanywhere.com',
  justjoin: 'justjoin.it',
  nodesk: 'nodesk.co',
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface JobToEnrich {
  id: string
  url: string
  source: string
  applyUrl: string | null
}

function normalizeHost(host: string): string {
  return String(host || '').replace(/^www\./, '').toLowerCase()
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return normalizeHost(new URL(url).hostname)
  } catch {
    return null
  }
}

function isInternalApplyUrl(applyUrl: string | null | undefined, boardHost: string): boolean {
  const host = hostOf(applyUrl)
  if (!host) return false
  return host === normalizeHost(boardHost)
}

function getBoardHost(source: string): string | null {
  if (!source.startsWith('board:')) return null
  const board = source.replace(/^board:/, '')
  return BOARD_HOSTS[board] ?? null
}

async function extractApplyUrl(
  page: any,
  jobUrl: string,
  boardHost: string,
): Promise<string | null> {
  try {
    await page.goto(jobUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    await delay(2000)

    let applyUrl: string | null = null

    try {
      const html = await page.content()
      applyUrl = extractApplyDestinationFromHtml(html, jobUrl)
    } catch {
      applyUrl = null
    }

    if (!applyUrl) {
      applyUrl = await extractApplyDestination(page, jobUrl)
    }

    if (applyUrl && !isExternalToHost(applyUrl, boardHost)) {
      return null
    }

    return applyUrl || null

  } catch (err) {
    __serr(`❌ Error extracting apply URL from ${jobUrl}:`, err)
    return null
  }
}

async function enrichApplyUrls(sources: string[], dryRun = false) {
  __slog(`\n🚀 Starting apply URL enrichment for sources: ${sources.join(', ')}`)
  __slog(`Dry run: ${dryRun ? 'YES' : 'NO'}\n`)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    for (const source of sources) {
      __slog(`\n📋 Processing source: ${source}`)

      const boardHost = getBoardHost(source)
      if (!boardHost) {
        __slog(`  ⚠️  No board host mapping for ${source}; skipping`)
        continue
      }

      // Get jobs that need enrichment
      const jobs = await prisma.job.findMany({
        where: {
          source,
          isExpired: false,
          OR: [
            { applyUrl: null },
            { applyUrl: { contains: boardHost } },
            { applyUrl: { contains: `www.${boardHost}` } },
          ],
        },
        select: {
          id: true,
          url: true,
          source: true,
          applyUrl: true,
        },
        take: BATCH_SIZE,
      })

      __slog(`Found ${jobs.length} jobs to enrich`)

      if (jobs.length === 0) continue

      const page = await browser.newPage()
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      )

      let enriched = 0
      let failed = 0

      for (const job of jobs) {
        if (!job.url) {
          __slog(`Skipping (missing url): ${job.id}`)
          failed++
          continue
        }

        const urlHost = hostOf(job.url)
        if (urlHost && urlHost !== normalizeHost(boardHost)) {
          __slog(`Skipping (non-board url): ${job.url}`)
          failed++
          continue
        }

        if (!isInternalApplyUrl(job.applyUrl, boardHost) && job.applyUrl) {
          __slog(`Skipping (already external): ${job.url}`)
          continue
        }

        __slog(`Processing: ${job.url}`)

        const directUrl = await extractApplyUrl(page, job.url, boardHost)

        if (directUrl) {
          __slog(`  ✅ Found: ${directUrl}`)

          if (!dryRun) {
            await prisma.job.update({
              where: { id: job.id },
              data: { applyUrl: directUrl },
            })
          }

          enriched++
        } else {
          __slog(`  ❌ No direct URL found`)
          failed++
        }

        await delay(DELAY_BETWEEN_REQUESTS)
      }

      await page.close()

      __slog(`\n✅ ${source}: Enriched ${enriched}, Failed ${failed}`)
    }

  } finally {
    await browser.close()
    await prisma.$disconnect()
  }
}

// Run enrichment
const sources = Object.keys(BOARD_HOSTS).map((board) => `board:${board}`)

const dryRun = process.argv.includes('--dry-run')

enrichApplyUrls(sources, dryRun)
  .then(() => {
    __slog('\n✅ Enrichment complete!')
    process.exit(0)
  })
  .catch((err) => {
    __serr('❌ Fatal error:', err)
    process.exit(1)
  })
