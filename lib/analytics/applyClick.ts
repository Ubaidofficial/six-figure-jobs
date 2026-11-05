// Counting clicks on Apply buttons. Client-safe (no Node imports) so the browser component can share the constants.
//
// Privacy: a row is {job, which button, phone/computer, time}. No IP address, user agent, cookie or visitor id is
// stored. The server only holds a hash of IP+user agent in memory for a few minutes, to ignore repeat clicks.
// Do Not Track and Global Privacy Control are honoured by the browser component (nothing is sent).

export const APPLY_SURFACES = ['apply-card', 'mobile-bar'] as const
export type ApplySurface = (typeof APPLY_SURFACES)[number]
export const APPLY_DEVICES = ['mobile', 'desktop'] as const
export type ApplyDevice = (typeof APPLY_DEVICES)[number]

export type ApplyClickInput = { jobId: string; surface: ApplySurface; device: ApplyDevice }

export function validateApplyClick(body: unknown): ApplyClickInput | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const jobId = typeof b.jobId === 'string' ? b.jobId.trim() : ''
  if (!jobId || jobId.length > 80) return null
  if (!(APPLY_SURFACES as readonly unknown[]).includes(b.surface)) return null
  if (!(APPLY_DEVICES as readonly unknown[]).includes(b.device)) return null
  return { jobId, surface: b.surface as ApplySurface, device: b.device as ApplyDevice }
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|preview|monitor|curl|wget|python-requests|axios|node-fetch|go-http-client/i

/** Crawlers and scripts do not click Apply; ignore anything that identifies itself as one (or says nothing). */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.length < 10) return true
  return BOT_PATTERN.test(userAgent)
}
