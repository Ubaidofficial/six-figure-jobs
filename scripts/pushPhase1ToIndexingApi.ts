// scripts/pushPhase1ToIndexingApi.ts
//
// One-shot: enumerate the ~50 Phase 1 URLs from lib/seo/indexingPhase + the
// priority-company list, and ping Google's Indexing API with URL_UPDATED for
// each. Run after deploying the Phase 1 sitemap silencing so Google's crawl
// queue gets re-seeded with just the tier-1 pages.
//
// Run via Railway so secrets stay server-side:
//   railway run --service six-figure-jobs npx tsx scripts/pushPhase1ToIndexingApi.ts
//
// Add --dry-run to print the URL list without calling the API.

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

function buildPhase1Urls(): string[] {
  const urls = new Set<string>()

  // Hubs
  for (const hub of ALWAYS_INDEXABLE_HUBS) {
    urls.add(`${SITE}${hub === '/' ? '' : hub}`)
  }

  // Role salary guides
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

  // Priority companies (top 20 — already curated in priorityCompanies.ts)
  for (const slug of PRIORITY_COMPANY_SLUGS) {
    urls.add(`${SITE}/company/${slug}`)
  }

  return Array.from(urls).sort()
}

async function main() {
  const urls = buildPhase1Urls()
  console.log(JSON.stringify({ urlCount: urls.length, dryRun: DRY_RUN }))

  if (DRY_RUN) {
    for (const url of urls) console.log(url)
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

  // Google Indexing API has rate limits (~200 URLs/day per project). Stay
  // well under by capping concurrency low and surfacing failures early.
  const results = await notifyUrls(urls, { type: 'URL_UPDATED', concurrency: 2 })

  let ok = 0
  let fail = 0
  for (const r of results) {
    if (r.success) {
      ok++
    } else {
      fail++
      // Redact any long tokens that might appear in error messages.
      const safeError = (r.error ?? '').replace(/[A-Za-z0-9_\-]{40,}/g, '<redacted>')
      console.log(JSON.stringify({ url: r.url, ok: false, error: safeError }))
    }
  }

  console.log(JSON.stringify({ total: urls.length, ok, fail }))
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('push failed:', err instanceof Error ? err.message : String(err))
  process.exit(2)
})
