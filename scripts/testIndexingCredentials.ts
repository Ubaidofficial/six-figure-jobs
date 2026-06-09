// scripts/testIndexingCredentials.ts
//
// One-shot probe: confirms the Google Indexing API credentials in the current
// env actually work. Pings the homepage with URL_UPDATED (a normal, no-op-ish
// operation) and prints {success, error} only — no secret values are echoed.
//
// Run via Railway so secrets stay server-side:
//   railway run --service six-figure-jobs npx tsx scripts/testIndexingCredentials.ts

import { hasIndexingCredentials, notifyUrls } from '../lib/indexing/googleIndexingClient'

async function main() {
  const present = hasIndexingCredentials()
  console.log(JSON.stringify({ credentialsDetected: present }))

  if (!present) {
    console.log(
      JSON.stringify({
        result: 'no_credentials',
        hint: 'set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN, or a service-account JSON env',
      }),
    )
    process.exit(1)
  }

  const url = 'https://www.6figjobs.com/'
  const [result] = await notifyUrls([url], { type: 'URL_UPDATED', concurrency: 1 })

  const safe = {
    url,
    success: result?.success ?? false,
    error: result?.error
      ? // Strip anything that looks like a long token, just in case the
        // upstream API echoes back a fragment of credentials.
        result.error.replace(/[A-Za-z0-9_\-]{40,}/g, '<redacted>')
      : null,
  }
  console.log(JSON.stringify(safe))
  process.exit(safe.success ? 0 : 1)
}

main().catch((err) => {
  console.error('test failed:', err instanceof Error ? err.message : String(err))
  process.exit(2)
})
