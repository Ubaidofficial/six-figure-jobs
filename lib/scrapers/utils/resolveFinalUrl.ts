// lib/scrapers/utils/resolveFinalUrl.ts

function looksLikeAbsoluteHttpUrl(maybeUrl: string): boolean {
  return /^https?:\/\//i.test(String(maybeUrl || '').trim())
}

function normalizeHost(host: string): string {
  return String(host || '').replace(/^www\./, '').toLowerCase()
}

function padBase64(s: string): string {
  const str = String(s || '').trim()
  const padLen = (4 - (str.length % 4)) % 4
  return str + '='.repeat(padLen)
}

function base64Decode(s: string): string {
  return Buffer.from(padBase64(s), 'base64').toString('utf8')
}

function reverseString(s: string): string {
  return String(s || '').split('').reverse().join('')
}

function extractMetaRefreshUrl(html: string): string | null {
  const m = html.match(/http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i)
  if (!m) return null
  const url = m[1]?.trim() || ''
  return looksLikeAbsoluteHttpUrl(url) ? url : null
}

function extractJsRedirectUrl(html: string): string | null {
  const m =
    html.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i) ||
    html.match(/location\.href\s*=\s*["']([^"']+)["']/i) ||
    null
  if (!m) return null
  const url = m[1]?.trim() || ''
  return looksLikeAbsoluteHttpUrl(url) ? url : null
}

function decodeRemoteOkRedirectHtml(html: string): string | null {
  if (!html) return null

  // RemoteOK /l/ pages obfuscate the destination with a token + nested atob + reversals.
  // We detect the pattern and replicate the decode steps in Node.
  if (!/window\.location\.href\s*=\s*n\s*;?/i.test(html)) return null

  const nMatch = html.match(/\bn\s*=\s*'([^']+)'/m)
  if (!nMatch) return null

  const tokenMatch = html.match(/split\('([^']+)'\)\[1\]/)
  if (!tokenMatch) return null

  const nStr = nMatch[1]
  const token = tokenMatch[1]

  const part1 = nStr.split(token)[1]
  if (!part1) return null

  let inner1: string
  try {
    inner1 = base64Decode(reverseString(part1))
  } catch {
    return null
  }

  const innerPart = reverseString(inner1).split(token)[1]
  if (!innerPart) return null

  let inner2: string
  try {
    inner2 = base64Decode(innerPart)
  } catch {
    return null
  }

  const final = inner2.split(token)[1] || ''
  if (looksLikeAbsoluteHttpUrl(final)) return final
  if (final.startsWith('/')) return final
  return null
}

export async function resolveFinalUrl(
  url: string,
  opts: { referer?: string; maxHops?: number } = {},
): Promise<string | null> {
  let current = String(url || '').trim()
  if (!looksLikeAbsoluteHttpUrl(current)) return null

  const startHost = normalizeHost(new URL(current).hostname)
  const maxHops = opts.maxHops ?? 5

  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        ...(opts.referer ? { Referer: opts.referer } : null),
      },
      cache: 'no-store',
    })

    const status = res.status
    if (status >= 300 && status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return current
      current = new URL(loc, current).toString()
      continue
    }

    // Node fetch exposes final URL on res.url even when redirects are manual (it stays current).
    const finalHost = normalizeHost(new URL(current).hostname)
    if (finalHost && finalHost !== startHost) return current

    const html = await res.text().catch(() => '')

    if (startHost === 'remoteok.com') {
      const decoded = decodeRemoteOkRedirectHtml(html)
      if (decoded) {
        return looksLikeAbsoluteHttpUrl(decoded) ? decoded : new URL(decoded, current).toString()
      }
    }

    const metaUrl = extractMetaRefreshUrl(html)
    if (metaUrl) {
      current = metaUrl
      continue
    }

    const jsUrl = extractJsRedirectUrl(html)
    if (jsUrl) {
      current = jsUrl
      continue
    }

    return current
  }

  return current
}
