// GET /logo/domain/stripe.com or /logo/name/Acme%20Labs
// Redirects to the best available logo source, so pages and client components can use key-free same-origin
// logo URLs (see lib/companies/logo.ts). Sources, in order:
//   1. logo.dev, with the server-side publishable key (best quality) — only if LOGODEV_API_KEY is set;
//   2. icon.horse, a free service that needs no key (domains only) — also used on its own with no logo.dev key.
// The redirect targets are fixed hosts and the value is validated, so this cannot redirect anywhere else.
import { buildFallbackLogoUrl, buildLogoDevUrl } from '@/lib/companies/logo'

const CACHE = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
const PROBE_TIMEOUT_MS = 3000
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000
const MEMORY_MAX = 5000

// Remembers which source answered, so a logo is probed once per day per process, not once per page view.
const resolved = new Map<string, { url: string | null; expires: number }>()

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

async function returnsImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Accept: 'image/*' }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    const ok = res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')
    await res.body?.cancel()
    return ok
  } catch {
    return false
  }
}

async function resolveSource(kind: string, value: string, token: string): Promise<string | null> {
  const candidates = [buildLogoDevUrl(kind, value, token, true), buildFallbackLogoUrl(kind, value)].filter(
    (url): url is string => Boolean(url),
  )
  for (const [i, url] of candidates.entries()) {
    // The last source is returned without probing: nothing is left to fall back to.
    if (i === candidates.length - 1 || (await returnsImage(url))) return url
  }
  return null
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; value: string }> }) {
  const { kind, value: rawValue } = await params
  const value = safeDecode(rawValue)
  const key = `${kind}:${value.toLowerCase()}`

  let entry = resolved.get(key)
  if (!entry || entry.expires < Date.now()) {
    entry = { url: await resolveSource(kind, value, process.env.LOGODEV_API_KEY ?? ''), expires: Date.now() + MEMORY_TTL_MS }
    if (resolved.size >= MEMORY_MAX) resolved.clear()
    resolved.set(key, entry)
  }

  if (!entry.url) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } })
  }
  return new Response(null, { status: 302, headers: { Location: entry.url, 'Cache-Control': CACHE } })
}
