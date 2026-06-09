// scripts/auditPhase1IndexabilityLive.ts
//
// Hit every Phase 1 URL, parse `<meta name="robots">`, and bucket them as
// indexable / noindex / error. The Indexing API submitting a URL doesn't
// mean the live page actually allows indexing — page-level gates (5-job
// thresholds, etc.) can override.
//
// Run via `npx tsx scripts/auditPhase1IndexabilityLive.ts`
// Prints a JSON summary and a list of noindex URLs at the end.

import {
  ALWAYS_INDEXABLE_HUBS,
  PHASE_1_COUNTRY_CODES,
  PHASE_1_ROLE_SLUGS,
} from '../lib/seo/indexingPhase'
import { PRIORITY_COMPANY_SLUGS } from '../lib/seo/priorityCompanies'
import { COUNTRY_CODE_TO_SLUG } from '../lib/seo/countrySlug'
import { getSiteUrl } from '../lib/seo/site'

const SITE = getSiteUrl()
const CONCURRENCY = 6

function buildPhase1Urls(): string[] {
  const urls = new Set<string>()
  for (const hub of ALWAYS_INDEXABLE_HUBS) {
    urls.add(`${SITE}${hub === '/' ? '' : hub}`)
  }
  for (const role of PHASE_1_ROLE_SLUGS) {
    urls.add(`${SITE}/salary/${role}`)
    urls.add(`${SITE}/jobs/${role}`)
    urls.add(`${SITE}/remote/${role}`)
  }
  for (const role of PHASE_1_ROLE_SLUGS) {
    for (const cc of PHASE_1_COUNTRY_CODES) {
      const slug = COUNTRY_CODE_TO_SLUG[cc]
      if (slug) urls.add(`${SITE}/salary/${role}/${slug}`)
    }
  }
  for (const slug of PRIORITY_COMPANY_SLUGS) {
    urls.add(`${SITE}/company/${slug}`)
  }
  return Array.from(urls).sort()
}

type Check = {
  url: string
  status: number | null
  robots: string | null
  title: string | null
  indexable: boolean
  reason: string
}

async function checkOne(url: string): Promise<Check> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'SixFigureJobsPhase1Audit/1.0' },
    })
    const status = res.status
    const html = await res.text()

    const robotsMatch = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)
    const robots = robotsMatch?.[1] ?? null

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const title = titleMatch?.[1]?.trim() ?? null

    const isNoindex = !!robots && /noindex/i.test(robots)
    const indexable = status === 200 && !isNoindex
    const reason =
      status !== 200
        ? `http_${status}`
        : isNoindex
          ? 'noindex_meta'
          : 'ok'

    return { url, status, robots, title, indexable, reason }
  } catch (err) {
    return {
      url,
      status: null,
      robots: null,
      title: null,
      indexable: false,
      reason: `error:${err instanceof Error ? err.message : String(err)}`,
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
  const urls = buildPhase1Urls()
  console.log(JSON.stringify({ total: urls.length, concurrency: CONCURRENCY }))

  const checks = await runWithConcurrency(urls, checkOne, CONCURRENCY)

  const indexable = checks.filter((c) => c.indexable)
  const noindex = checks.filter((c) => c.reason === 'noindex_meta')
  const errors = checks.filter((c) => c.reason !== 'ok' && c.reason !== 'noindex_meta')

  console.log(
    JSON.stringify({
      indexable: indexable.length,
      noindex: noindex.length,
      errors: errors.length,
    }),
  )

  if (noindex.length > 0) {
    console.log('\n--- Currently noindex ---')
    for (const c of noindex) {
      console.log(`${c.url}  ::  ${c.title ?? ''}`)
    }
  }

  if (errors.length > 0) {
    console.log('\n--- Errors ---')
    for (const c of errors) {
      console.log(`${c.url}  ::  ${c.reason}`)
    }
  }

  console.log('\n--- Indexable ---')
  for (const c of indexable) {
    console.log(c.url)
  }
}

main().catch((err) => {
  console.error('audit failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
