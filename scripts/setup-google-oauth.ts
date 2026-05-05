// scripts/setup-google-oauth.ts
// One-time setup: exchange an OAuth2 authorization code for a refresh token.
//
// Run once locally to get your GOOGLE_OAUTH_REFRESH_TOKEN, then set it in Railway.
//
// Usage:
//   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... npx tsx scripts/setup-google-oauth.ts

import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/indexing'
const REDIRECT_URI = 'http://localhost'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET before running.')
  console.error('')
  console.error('  GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy npx tsx scripts/setup-google-oauth.ts')
  process.exit(1)
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`

async function main() {
  console.log('─────────────────────────────────────────────────────────')
  console.log('  Google Indexing API — OAuth2 Setup')
  console.log('─────────────────────────────────────────────────────────')
  console.log('')
  console.log('Step 1: Open this URL in your browser (logged in as the')
  console.log('        Google account that OWNS the Search Console property):')
  console.log('')
  console.log(' ', authUrl)
  console.log('')
  console.log('Step 2: Google will redirect you to http://localhost/?code=...')
  console.log('        The page will fail to load — that is expected.')
  console.log('        Copy the "code" value from the URL bar.')
  console.log('')

  const rl = readline.createInterface({ input, output })
  const code = (await rl.question('Paste the code here: ')).trim()
  rl.close()

  if (!code) {
    console.error('No code provided. Exiting.')
    process.exit(1)
  }

  console.log('\nExchanging code for refresh token...')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  const json = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    error?: string
    error_description?: string
  }

  if (!res.ok || !json.refresh_token) {
    console.error('\nFailed to get refresh token:')
    console.error(`  status: ${res.status}`)
    console.error(`  error: ${json.error ?? 'unknown'}`)
    console.error(`  detail: ${json.error_description ?? ''}`)
    console.error('')
    console.error('Common causes:')
    console.error('  - Code was already used (codes are single-use)')
    console.error('  - CLIENT_ID or CLIENT_SECRET is wrong')
    console.error('  - Redirect URI mismatch (must be http://localhost in GCP)')
    process.exit(1)
  }

  console.log('')
  console.log('─────────────────────────────────────────────────────────')
  console.log('  SUCCESS — add these to Railway environment variables:')
  console.log('─────────────────────────────────────────────────────────')
  console.log('')
  console.log(`GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}`)
  console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}`)
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${json.refresh_token}`)
  console.log('')
  console.log('The refresh token does not expire unless you revoke access.')
  console.log('─────────────────────────────────────────────────────────')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
