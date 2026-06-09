// scripts/pushPhase1ToIndexingApi.ts
//
// One-shot: enumerate the ~105 Phase 1 URLs from lib/seo/indexingPhase + the
// priority-company list, **pre-filter to URLs the live page actually allows
// indexing on right now**, and ping Google's Indexing API with URL_UPDATED
// for the survivors.
//
// Why pre-filter: the v1 of this script submitted all 105 URLs blindly.
// Page-level gates (5-job thresholds, etc.) noindex thin pages even when
// they're in the Phase 1 allowlist — Google then rejects the indexing
// request and our daily Indexing API quota gets burned on dead-on-arrival
// URLs. Fetching each candidate first and checking `<meta name="robots">`
// keeps us efficient.
//
// Run via Railway so secrets stay server-side:
//   railway run --service six-figure-jobs npx tsx scripts/pushPhase1ToIndexingApi.ts
//
// Flags:
//   --dry-run        Print URLs without calling the API
//   --no-prefilter   Skip the live indexability check (legacy v1 behavior)

import {
  ALWAYS_INDEXABLE_HUBS,
  PHASE_1_COUNTRY_CODES,
  PHASE_1_ROLE_SLUGS,
} from '../lib/seo/indexingPhase'
import { PRIORITY_COMPANY_SLUGS } from '../lib/seo/priorityCompanies'
import {
  hasIndexingCredentials,
  notifyUrls,
} from '../lib/indexing/googleIndexingClient'
import { getSiteUrl } from '../lib/seo/site'
import { COUNTRY_CODE_TO_SLUG } from '../lib/seo/countrySlug'

const SITE = getSiteUrl()
const DRY_RUN = process.argv.includes('--dry-run')
const SKIP_PREFILTER = process.argv.includes('--no-prefilter')

const PREFILTER_CONCURRENCY = 6
const PREFILTER_TIMEOUT_MS = 15_000

function buildPhase1Urls(): string[] {
  const urls = new Set<string>()

  // Hubs
  for (const hub of ALWAYS_INDEXABLE_HUBS) {
    urls.add(`${SITE}${hub === '/' ? '' : hub}`)
  }

  // Role salary guides + jobs hub + remote hub
  for (const role of PHASE_1_ROLE_SLUGS) {
    urls.add(`${SITE}/salary/${role}`)
    urls.add(`${SITE}/jobs/${role}`)
    urls.add(`${SITE}/remote/${role}`)
  }

  // Role × country salary pages
  for (const role of PHASE_1_ROLE_SLUGS) {
    for (const cc of PHASE_1_COUNTRY_CODES) {
      const slug = COUNTRY_CODE_TO_SLUG[cc]
      if (slug) urls.add(`${SITE}/salary/${role}/${slug}`)
    }
  }

  // Priority companies
  for (const slug of PRIORITY_COMPANY_SLUGS) {
    urls.add(`${SITE}/company/${slug}`)
  }

  return Array.from(urls).sort()
}

type LiveCheck = {
  url: string
  status: number | null
  isNoindex: boolean
  reason: string
}

async function checkLiveIndexability(url: string): Promise<LiveCheck> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PREFILTER_TIMEOUT_MS)
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'SixFigureJobsPhase1Push/1.0' },
    })
    clearTimeout(timer)

    if (res.status !== 200) {
      return { url, status: res.status, isNoindex: false, reason: `http_${res.status}` }
    }
    const html = await res.text()

    // Check both <meta name="robots"> and the X-Robots-Tag header — either
    // can carry noindex, and we want to skip the URL in either case.
    const metaMatch = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)
    const xRobots = res.headers.get('x-robots-tag') ?? ''
    const robotsCombined = `${metaMatch?.[1] ?? ''} ${xRobots}`
    const isNoindex = /noindex/i.test(robotsCombined)

    return {
      url,
      status: res.status,
      isNoindex,
      reason: isNoindex ? 'noindex' : 'ok',
    }
  } catch (err) {
    return {
      url,
      status: null,
      isNoindex: false,
      reason: `fetch_error:${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await worker(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

async function main() {
  const allUrls = buildPhase1Urls()
  console.log(JSON.stringify({ candidate_count: allUrls.length, dry_run: DRY_RUN, prefilter: !SKIP_PREFILTER }))

  let pushable = allUrls
  let skipped: LiveCheck[] = []

  if (!SKIP_PREFILTER) {
    const checks = await runWithConcurrency(allUrls, checkLiveIndexability, PREFILTER_CONCURRENCY)
    pushable = checks.filter((c) => c.reason === 'ok').map((c) => c.url)
    skipped = checks.filter((c) => c.reason !== 'ok')

    console.log(
      JSON.stringify({
        after_prefilter: pushable.length,
        skipped: skipped.length,
        skipped_breakdown: skipped.reduce<Record<string, number>>((acc, c) => {
          const key = c.reason.startsWith('fetch_error') ? 'fetch_error' : c.reason
          acc[key] = (acc[key] ?? 0) + 1
          return acc
        }, {}),
      }),
    )

    if (skipped.length > 0) {
      console.log('\n--- Skipped URLs (not pushed to Indexing API) ---')
      for (const c of skipped) {
        console.log(`${c.reason.padEnd(18)} ${c.url}`)
      }
      console.log('')
    }
  }

  if (DRY_RUN) {
    console.log('--- Would push ---')
    for (const url of pushable) console.log(url)
    return
  }

  if (pushable.length === 0) {
    console.log(JSON.stringify({ result: 'nothing_to_push' }))
    return
  }

  if (!hasIndexingCredentials()) {
    console.log(
      JSON.stringify({
        error: 'no_credentials',
        hint: 'set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN',
      }),
    )
    process.exit(1)
  }

  const results = await notifyUrls(pushable, { type: 'URL_UPDATED', concurrency: 2 })

  let ok = 0
  let fail = 0
  for (const r of results) {
    if (r.success) {
      ok++
    } else {
      fail++
      const safeError = (r.error ?? '').replace(/[A-Za-z0-9_\-]{40,}/g, '<redacted>')
      console.log(JSON.stringify({ url: r.url, ok: false, error: safeError }))
    }
  }

  console.log(JSON.stringify({ submitted: pushable.length, ok, fail, skipped: skipped.length }))
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('push failed:', err instanceof Error ? err.message : String(err))
  process.exit(2)
})
