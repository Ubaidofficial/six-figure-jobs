import { createSign } from 'node:crypto'

type SitemapEntry = {
  loc: string
  lastmod: string | null
}

type ServiceAccountCredentials = {
  client_email: string
  private_key: string
}

type IndexingRequestType = 'URL_UPDATED' | 'URL_DELETED'

const DEFAULT_BASE_URL = 'https://www.6figjobs.com'
const BASE_URL = (process.env.INDEXING_API_BASE_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_BASE_URL)
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
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const INDEXING_API_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish'
const SCOPE = 'https://www.googleapis.com/auth/indexing'

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

function getCredentials(): ServiceAccountCredentials {
  const rawJson = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON
  if (rawJson) {
    const parsed = JSON.parse(rawJson) as Partial<ServiceAccountCredentials>
    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: normalizePrivateKey(parsed.private_key),
      }
    }
  }

  const clientEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Missing Google Indexing API credentials. Set GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON or GOOGLE_INDEXING_CLIENT_EMAIL + GOOGLE_INDEXING_PRIVATE_KEY.',
    )
  }

  return {
    client_email: clientEmail,
    private_key: normalizePrivateKey(privateKey),
  }
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n')
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function buildJwt(credentials: ServiceAccountCredentials): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claimSet = {
    iss: credentials.client_email,
    scope: SCOPE,
    aud: OAUTH_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claimSet))}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key)
  return `${unsigned}.${base64Url(signature)}`
}

async function getAccessToken(): Promise<string> {
  const credentials = getCredentials()
  const assertion = buildJwt(credentials)
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string }

  if (!res.ok || !json.access_token) {
    throw new Error(
      `OAuth token request failed status=${res.status} error=${json.error || 'unknown'} detail=${json.error_description || ''}`,
    )
  }

  return json.access_token
}

async function publishUrl(url: string, token: string): Promise<void> {
  const res = await fetch(INDEXING_API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url, type: REQUEST_TYPE }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Indexing API failed status=${res.status} url=${url} body=${body.slice(0, 240)}`)
  }
}

async function runQueue(urls: string[], worker: (url: string) => Promise<void>): Promise<number> {
  let index = 0
  let failures = 0

  async function next() {
    while (index < urls.length) {
      const url = urls[index]
      index += 1

      try {
        await worker(url)
      } catch (error) {
        failures += 1
        console.error(`[indexing] failed url=${url} error=${String((error as Error).message || error)}`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => next()))
  return failures
}

async function main() {
  console.log(`[indexing] sitemap=${JOB_SITEMAP_INDEX_URL}`)
  console.log(`[indexing] type=${REQUEST_TYPE} dryRun=${DRY_RUN} maxUrls=${MAX_URLS}`)
  if (SINCE) console.log(`[indexing] since=${SINCE.toISOString()}`)

  const urls = await collectJobUrls()
  console.log(`[indexing] collected=${urls.length}`)

  if (urls.length === 0) return

  if (DRY_RUN) {
    urls.slice(0, 20).forEach((url) => console.log(`[indexing] dry-run ${REQUEST_TYPE} ${url}`))
    if (urls.length > 20) console.log(`[indexing] dry-run omitted=${urls.length - 20}`)
    console.log('[indexing] set INDEXING_API_DRY_RUN=0 to publish notifications')
    return
  }

  const token = await getAccessToken()
  const failures = await runQueue(urls, (url) => publishUrl(url, token))
  console.log(`[indexing] submitted=${urls.length - failures} failed=${failures}`)
  if (failures > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('[indexing] fatal:', error)
  process.exitCode = 1
})
