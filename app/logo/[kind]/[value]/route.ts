// GET /logo/domain/stripe.com or /logo/name/Acme%20Labs
// Redirects to the best available logo source, so pages and client components can use key-free same-origin
// logo URLs (see lib/companies/logo.ts). Sources, in order:
//   1. logo.dev, with the server-side publishable key (best quality) — only if LOGODEV_API_KEY is set;
//   2. icon.horse, a free service that needs no key (domains only) — also used on its own with no logo.dev key.
// The redirect targets are fixed hosts and the value is validated, so this cannot redirect anywhere else.
import { buildFallbackLogoUrl, buildLogoDevUrl } from '@/lib/companies/logo'

const CACHE = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
// A fallback chosen because logo.dev did not answer (rate limit, server error, timeout) is kept only briefly, then
// logo.dev is asked again. On 2026-11-09 a burst of lookups got icon.horse for ~250 companies logo.dev does have
// (Intel, Docker, Zapier...), and that answer was remembered for a day and cacheable for a week.
const SHORT_CACHE = 'public, max-age=300'
const SHORT_TTL_MS = 5 * 60 * 1000
const PROBE_TIMEOUT_MS = 3000
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000
const MEMORY_MAX = 5000

// Remembers which source answered, so a logo is probed once per day per process, not once per page view.
const resolved = new Map<string, { url: string | null; settled: boolean; expires: number }>()

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** 'yes' (an image), 'no' (the source answered that it has none), or 'unknown' (rate limit, server error, timeout). */
async function probe(url: string): Promise<'yes' | 'no' | 'unknown'> {
  try {
    const res = await fetch(url, { headers: { Accept: 'image/*' }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    const image = res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')
    await res.body?.cancel()
    if (image) return 'yes'
    return res.ok || res.status === 404 ? 'no' : 'unknown'
  } catch {
    return 'unknown'
  }
}

/** The source to redirect to, and whether the answer is settled (worth remembering for a day). */
async function resolveSource(kind: string, value: string, token: string): Promise<{ url: string | null; settled: boolean }> {
  const candidates = [buildLogoDevUrl(kind, value, token, true), buildFallbackLogoUrl(kind, value)].filter(
    (url): url is string => Boolean(url),
  )
  let settled = true
  for (const [i, url] of candidates.entries()) {
    // The last source is returned without probing: nothing is left to fall back to.
    if (i === candidates.length - 1) return { url, settled }
    const answer = await probe(url)
    if (answer === 'yes') return { url, settled: true }
    if (answer === 'unknown') settled = false
  }
  return { url: null, settled }
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; value: string }> }) {
  const { kind, value: rawValue } = await params
  const value = safeDecode(rawValue)
  const key = `${kind}:${value.toLowerCase()}`

  let entry = resolved.get(key)
  if (!entry || entry.expires < Date.now()) {
    const source = await resolveSource(kind, value, process.env.LOGODEV_API_KEY ?? '')
    entry = { ...source, expires: Date.now() + (source.settled ? MEMORY_TTL_MS : SHORT_TTL_MS) }
    if (resolved.size >= MEMORY_MAX) resolved.clear()
    resolved.set(key, entry)
  }

  if (!entry.url) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } })
  }
  return new Response(null, { status: 302, headers: { Location: entry.url, 'Cache-Control': entry.settled ? CACHE : SHORT_CACHE } })
}
