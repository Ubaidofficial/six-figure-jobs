import { createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export type GoogleIndexingNotificationType = 'URL_UPDATED' | 'URL_DELETED'

type ServiceAccountKey = {
  client_email?: string
  private_key?: string
  token_uri?: string
}

const DEFAULT_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const INDEXING_API_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish'
const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing'

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n')
}

async function readServiceAccountKey(): Promise<Required<Pick<ServiceAccountKey, 'client_email' | 'private_key'>> & { token_uri: string }> {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim()
  if (!keyPath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_PATH is required for Google Indexing API notifications')
  }

  const raw = await readFile(keyPath, 'utf8')
  const parsed = JSON.parse(raw) as ServiceAccountKey
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(`Invalid Google service account key at ${keyPath}`)
  }

  return {
    client_email: parsed.client_email,
    private_key: normalizePrivateKey(parsed.private_key),
    token_uri: parsed.token_uri || DEFAULT_TOKEN_URL,
  }
}

function buildJwt(key: Awaited<ReturnType<typeof readServiceAccountKey>>): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claimSet = {
    iss: key.client_email,
    scope: INDEXING_SCOPE,
    aud: key.token_uri,
    exp: now + 3600,
    iat: now,
  }

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claimSet))}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key)
  return `${unsigned}.${base64Url(signature)}`
}

async function getAccessToken(): Promise<string> {
  const key = await readServiceAccountKey()
  const response = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildJwt(key),
    }),
  })

  const payload = (await response.json()) as { access_token?: string; error?: string }
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google Indexing API auth failed: ${payload.error ?? response.status}`)
  }

  return payload.access_token
}

export async function notifyGoogleIndexing(
  url: string,
  type: GoogleIndexingNotificationType,
): Promise<unknown> {
  const accessToken = await getAccessToken()

  const response = await fetch(INDEXING_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ url, type }),
  })

  if (!response.ok) {
    console.error(`[GoogleIndexingAPI] Failed for ${url}:`, await response.text())
  }

  return response.json()
}

