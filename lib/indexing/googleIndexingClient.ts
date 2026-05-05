// lib/indexing/googleIndexingClient.ts
// Google Indexing API client — supports OAuth2 refresh token (preferred) or service account JWT

import { createSign } from 'node:crypto'

export type IndexingRequestType = 'URL_UPDATED' | 'URL_DELETED'

export type IndexingResult = {
  url: string
  success: boolean
  error?: string
}

type ServiceAccountCredentials = {
  client_email: string
  private_key: string
}

type OAuth2Credentials = {
  clientId: string
  clientSecret: string
  refreshToken: string
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const INDEXING_API_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish'
const SCOPE = 'https://www.googleapis.com/auth/indexing'

// ─── OAuth2 refresh token flow ────────────────────────────────────────────────

function resolveOAuth2Credentials(): OAuth2Credentials | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()
  if (clientId && clientSecret && refreshToken) return { clientId, clientSecret, refreshToken }
  return null
}

async function getAccessTokenViaOAuth2(creds: OAuth2Credentials): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const json = (await res.json()) as {
    access_token?: string
    error?: string
    error_description?: string
  }

  if (!res.ok || !json.access_token) {
    throw new Error(
      `OAuth2 token refresh failed status=${res.status} error=${json.error ?? 'unknown'} detail=${json.error_description ?? ''}`,
    )
  }

  return json.access_token
}

// ─── Service account JWT flow (fallback) ─────────────────────────────────────

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

function resolveServiceAccountCredentials(): ServiceAccountCredentials | null {
  const rawJson = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON?.trim()
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Partial<ServiceAccountCredentials>
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: normalizePrivateKey(parsed.private_key),
        }
      }
    } catch {}
  }

  const clientEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY?.trim()
  if (clientEmail && privateKey) {
    return { client_email: clientEmail, private_key: normalizePrivateKey(privateKey) }
  }

  return null
}

function buildJwt(creds: ServiceAccountCredentials): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claimSet = {
    iss: creds.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claimSet))}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(creds.private_key)
  return `${unsigned}.${base64Url(signature)}`
}

async function getAccessTokenViaServiceAccount(creds: ServiceAccountCredentials): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildJwt(creds),
    }),
  })

  const json = (await res.json()) as {
    access_token?: string
    error?: string
    error_description?: string
  }

  if (!res.ok || !json.access_token) {
    throw new Error(
      `Service account token failed status=${res.status} error=${json.error ?? 'unknown'} detail=${json.error_description ?? ''}`,
    )
  }

  return json.access_token
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function hasIndexingCredentials(): boolean {
  return resolveOAuth2Credentials() !== null || resolveServiceAccountCredentials() !== null
}

/**
 * Returns an access token using OAuth2 refresh token if configured,
 * falling back to service account JWT.
 */
export async function getAccessToken(): Promise<string> {
  const oauth2 = resolveOAuth2Credentials()
  if (oauth2) return getAccessTokenViaOAuth2(oauth2)

  const sa = resolveServiceAccountCredentials()
  if (sa) return getAccessTokenViaServiceAccount(sa)

  throw new Error(
    'No Google Indexing API credentials found. Set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET + GOOGLE_OAUTH_REFRESH_TOKEN, or GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON.',
  )
}

export async function publishUrl(
  url: string,
  token: string,
  type: IndexingRequestType = 'URL_UPDATED',
): Promise<void> {
  const res = await fetch(INDEXING_API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url, type }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `Indexing API error status=${res.status} url=${url} body=${body.slice(0, 240)}`,
    )
  }
}

/**
 * Notify Google Indexing API for a batch of URLs.
 * Returns per-URL results. Never throws — errors are captured per entry.
 */
export async function notifyUrls(
  urls: string[],
  options: {
    type?: IndexingRequestType
    concurrency?: number
  } = {},
): Promise<IndexingResult[]> {
  if (urls.length === 0) return []

  const type = options.type ?? 'URL_UPDATED'
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 16))

  const token = await getAccessToken()
  const results: IndexingResult[] = []
  let index = 0

  async function worker() {
    while (index < urls.length) {
      const url = urls[index++]
      try {
        await publishUrl(url, token, type)
        results.push({ url, success: true })
      } catch (err) {
        results.push({ url, success: false, error: String((err as Error).message ?? err) })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker))
  return results
}
