// GET /logo/domain/stripe.com or /logo/name/Acme%20Labs
// Redirects to logo.dev with the server-side publishable key, so pages and client components can use
// key-free same-origin logo URLs (see lib/companies/logo.ts). The redirect target host is fixed and the
// value is validated, so this cannot be used to redirect anywhere else.
import { buildLogoDevUrl } from '@/lib/companies/logo'

const CACHE = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; value: string }> }) {
  const { kind, value } = await params
  const token = process.env.LOGODEV_API_KEY ?? ''
  const target = buildLogoDevUrl(kind, safeDecode(value), token)

  if (!target) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } })
  }

  return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': CACHE } })
}
