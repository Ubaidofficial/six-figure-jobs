// scripts/notify-google-indexing.ts
// Notify Google Indexing API for job URLs found in the jobs sitemap.
//
// Usage:
//   npm run google:indexing:jobs
//
// Env vars:
//   GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON   — full service account JSON string
//   GOOGLE_INDEXING_CLIENT_EMAIL           — or separate email + key
//   GOOGLE_INDEXING_PRIVATE_KEY
//   INDEXING_API_DRY_RUN                   — "0" to actually publish (default: dry run)
//   INDEXING_API_MAX_URLS                  — cap per run (default: 200)
//   INDEXING_API_SINCE                     — ISO date; skip jobs older than this
//   INDEXING_API_CONCURRENCY               — parallel requests (default: 4)
//   INDEXING_API_REQUEST_TYPE              — "URL_UPDATED" | "URL_DELETED" (default: URL_UPDATED)
//   INDEXING_API_JOB_SITEMAP_URL           — override sitemap index URL
//   INDEXING_API_BASE_URL                  — override base URL for canonical links

import { type IndexingRequestType } from '../lib/indexing/googleIndexingClient'
import { prisma } from '../lib/prisma'
import { parseJobSlugParam } from '../lib/jobs/jobSlug'
import { enqueueJobIndexingUpdate, enqueueJobIndexingDelete } from '../lib/jobs/indexingQueue'

type SitemapEntry = {
  loc: string
  lastmod: string | null
}

const DEFAULT_BASE_URL = 'https://www.6figjobs.com'
const BASE_URL = (
  process.env.INDEXING_API_BASE_URL ||
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  DEFAULT_BASE_URL
)
  .trim()
  .replace(/\/+$/, '')

const JOB_SITEMAP_INDEX_URL = (
  process.env.INDEXING_API_JOB_SITEMAP_URL || `${BASE_URL}/sitemap-jobs.xml`
).trim()

const MAX_URLS = Math.max(1, Number(process.env.INDEXING_API_MAX_URLS || '200'))
const REQUEST_TYPE = normalizeRequestType(process.env.INDEXING_API_REQUEST_TYPE)
const DRY_RUN = process.env.INDEXING_API_DRY_RUN !== '0'
const SINCE = process.env.INDEXING_API_SINCE ? new Date(process.env.INDEXING_API_SINCE) : null
const CONCURRENCY = Math.max(1, Math.min(16, Number(process.env.INDEXING_API_CONCURRENCY || '4')))

function normalizeRequestType(value: string | undefined): IndexingRequestType {
  return value === 'URL_DELETED' ? 'URL_DELETED' : 'URL_UPDATED'
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i'))
  return match?.[1]?.trim() || null
}

function extractSitemapEntries(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = []
  const re = /<(url|sitemap)>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(xml)) !== null) {
    const body = match[2] || ''
    const loc = extractTag(body, 'loc')
    if (!loc) continue
    entries.push({ loc, lastmod: extractTag(body, 'lastmod') })
  }

  return entries
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { accept: 'application/xml,text/xml,*/*' },
  })
  const body = await res.text()

  if (!res.ok) {
    throw new Error(`Fetch failed status=${res.status} url=${url} body=${body.slice(0, 160)}`)
  }

  return body
}

function isJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.pathname.startsWith('/job/')
  } catch {
    return false
  }
}

function isRecentEnough(entry: SitemapEntry): boolean {
  if (!SINCE) return true
  if (Number.isNaN(SINCE.getTime())) {
    throw new Error(`Invalid INDEXING_API_SINCE date: ${process.env.INDEXING_API_SINCE}`)
  }
  if (!entry.lastmod) return false

  const lastmod = new Date(entry.lastmod)
  if (Number.isNaN(lastmod.getTime())) return false
  return lastmod.getTime() >= SINCE.getTime()
}

async function collectJobUrls(): Promise<string[]> {
  const indexXml = await fetchXml(JOB_SITEMAP_INDEX_URL)
  const shardUrls = extractSitemapEntries(indexXml).map((entry) => entry.loc)

  const urls: string[] = []
  const seen = new Set<string>()

  for (const shardUrl of shardUrls) {
    if (urls.length >= MAX_URLS) break

    const shardXml = await fetchXml(shardUrl)
    const entries = extractSitemapEntries(shardXml)

    for (const entry of entries) {
      if (urls.length >= MAX_URLS) break
      if (!isJobUrl(entry.loc)) continue
      if (!isRecentEnough(entry)) continue
      if (seen.has(entry.loc)) continue

      seen.add(entry.loc)
      urls.push(entry.loc)
    }
  }

  return urls
}

async function main() {
  console.log(`[indexing] sitemap=${JOB_SITEMAP_INDEX_URL}`)
  console.log(`[indexing] type=${REQUEST_TYPE} dryRun=${DRY_RUN} maxUrls=${MAX_URLS}`)
  if (SINCE) console.log(`[indexing] since=${SINCE.toISOString()}`)

  const urls = await collectJobUrls()
  console.log(`[indexing] collected=${urls.length}`)

  if (urls.length === 0) return

  if (DRY_RUN) {
    console.log(`[indexing] --- DRY RUN MODE ---`)
    urls.slice(0, 20).forEach((url) => console.log(`[indexing] [dry-run] Would enqueue ${REQUEST_TYPE} for ${url}`))
    if (urls.length > 20) console.log(`[indexing] [dry-run] omitted=${urls.length - 20}`)
    console.log('[indexing] set INDEXING_API_DRY_RUN=0 to actually enqueue notifications')
    return
  }

  console.log(`[indexing] Enqueuing ${urls.length} URLs into the durable queue...`)
  let enqueued = 0
  let skipped = 0

  for (const url of urls) {
    try {
      const pathname = new URL(url).pathname
      const slug = pathname.split('/').pop() || ''
      const { jobId, shortId } = parseJobSlugParam(slug)
      const ors: any[] = []
      if (jobId) ors.push({ id: jobId })
      if (shortId) ors.push({ shortId })

      if (ors.length === 0) {
        console.log(`[indexing] Skipped: invalid slug identifier for ${url}`)
        skipped++
        continue
      }

      const job = await prisma.job.findFirst({
        where: { OR: ors },
        select: { id: true },
      })

      if (!job) {
        console.log(`[indexing] Skipped: job not found in DB for URL ${url}`)
        skipped++
        continue
      }

      if (REQUEST_TYPE === 'URL_UPDATED') {
        await enqueueJobIndexingUpdate(job.id, 'legacy_bulk_script')
      } else {
        await enqueueJobIndexingDelete(job.id, 'legacy_bulk_script')
      }
      enqueued++
    } catch (err: any) {
      console.error(`[indexing] Error enqueuing ${url}:`, err.message)
      skipped++
    }
  }

  console.log(`[indexing] Finished bulk enqueue: enqueued=${enqueued} skipped=${skipped}`)
  console.log(`[indexing] Run scripts/process-google-indexing-queue.ts to process the queue.`)
}

main().catch((error) => {
  console.error('[indexing] fatal:', error)
  process.exitCode = 1
})
