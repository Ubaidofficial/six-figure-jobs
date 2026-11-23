// lib/sponsors/slots.ts
//
// Sponsored placements, placed by hand from the admin Sponsors page (/ubaid93/sponsors). Each slot is five plain values
// under `sponsor.<n>.`: name, text, url, logo and until. A slot shows only while it is complete (a name, an https link and
// a last day) and that day has not passed, so a forgotten placement ends by itself. Nothing here ranks or adds a job.
import { DEFAULT_TTL_MS, memoAsync } from '../cache/memo'
import { prisma } from '../prisma'

export const SPONSOR_SLOT_COUNT = 2
export const SPONSOR_KEY_PREFIX = 'sponsor.'
export const SPONSOR_FIELDS = ['name', 'text', 'url', 'logo', 'until'] as const

const MAX_NAME = 60
const MAX_TEXT = 140

export type SponsorSlot = {
  id: number
  name: string
  text: string | null
  /** The link with UTM parameters added, so the sponsor can see the visits come from us. */
  href: string
  /** https image URL, or null (the card then shows initials). */
  logo: string | null
  /** The last day shown, as written (YYYY-MM-DD). */
  until: string
}

export { endOfDayUtc, httpsUrl } from './slotRules'
import { endOfDayUtc, httpsUrl } from './slotRules'

function withUtm(url: URL, id: number): string {
  const out = new URL(url.toString())
  if (!out.searchParams.has('utm_source')) out.searchParams.set('utm_source', '6figjobs')
  if (!out.searchParams.has('utm_medium')) out.searchParams.set('utm_medium', 'sponsored')
  if (!out.searchParams.has('utm_campaign')) out.searchParams.set('utm_campaign', `slot-${id}`)
  return out.toString()
}

/** Pure: the config values (key to text) to the slots that may show at `now`, in slot order. */
export function buildSponsorSlots(config: Record<string, string | undefined>, now: Date = new Date()): SponsorSlot[] {
  const slots: SponsorSlot[] = []
  for (let id = 1; id <= SPONSOR_SLOT_COUNT; id++) {
    const get = (field: (typeof SPONSOR_FIELDS)[number]) => config[`${SPONSOR_KEY_PREFIX}${id}.${field}`]?.trim() ?? ''
    const name = get('name').slice(0, MAX_NAME)
    const url = httpsUrl(get('url'))
    const until = endOfDayUtc(get('until'))
    if (!name || !url || !until || until.getTime() < now.getTime()) continue
    const text = get('text')
    slots.push({
      id,
      name,
      text: text ? (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1).trimEnd()}…` : text) : null,
      href: withUtm(url, id),
      logo: httpsUrl(get('logo'))?.toString() ?? null,
      until: get('until'),
    })
  }
  return slots
}

/**
 * The slots that may show now. The raw values are cached for a few minutes, but "has the last day passed" is decided on
 * every call, so a slot does not outlive its end date by the cache time. Any failure gives no slots: the page is fine
 * without them.
 */
export async function loadSponsorSlots(): Promise<SponsorSlot[]> {
  try {
    const config = await memoAsync('sponsor-config', DEFAULT_TTL_MS, async () => {
      const rows = await prisma.siteConfig.findMany({ where: { key: { startsWith: SPONSOR_KEY_PREFIX } } })
      return Object.fromEntries(rows.map((r) => [r.key, r.value]))
    })
    return buildSponsorSlots(config)
  } catch {
    return []
  }
}
