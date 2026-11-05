export const KNOWN_BOARD_HOSTS = new Set([
  // General job boards and aggregators. freehire collects from many of these, so a freehire job's apply link
  // usually points at one of them, never at the employer's own site.
  'whatjobs.com',
  'indeed.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'jooble.org',
  'adzuna.com',
  'talent.com',
  'careerjet.com',
  'jobrapido.com',
  'monster.com',
  'simplyhired.com',
  'reed.co.uk',
  'totaljobs.com',
  'cv-library.co.uk',
  'workopolis.com',
  'jobbank.gc.ca',
  'freehire.me',
  'europa.eu',
  'mycareersfuture.gov.sg',
  'catho.com.br',
  '4dayweek.io',
  'builtin.com',
  'dice.com',
  'himalayas.app',
  'justjoin.it',
  'nodesk.co',
  'otta.com',
  'realworkfromanywhere.com',
  'remote100k.com',
  'remoteai.com',
  'remoteleaf.com',
  'remoteok.com',
  'remoteotter.com',
  'remoterocketship.com',
  'remotive.com',
  'trawle.com',
  'weworkremotely.com',
  'wellfound.com',
  'ycombinator.com',
])

export const BOARD_SOURCE_HOSTS: Record<string, string> = {
  '4dayweek': '4dayweek.io',
  builtin: 'builtin.com',
  dice: 'dice.com',
  himalayas: 'himalayas.app',
  himalayayas: 'himalayas.app',
  justjoin: 'justjoin.it',
  nodesk: 'nodesk.co',
  otta: 'otta.com',
  realworkfromanywhere: 'realworkfromanywhere.com',
  remote100k: 'remote100k.com',
  remoteai: 'remoteai.com',
  remoteleaf: 'remoteleaf.com',
  remoteok: 'remoteok.com',
  remoteotter: 'remoteotter.com',
  remoterocketship: 'remoterocketship.com',
  remotive: 'remotive.com',
  trawle: 'trawle.com',
  weworkremotely: 'weworkremotely.com',
  wellfound: 'wellfound.com',
  ycombinator: 'ycombinator.com',
}

export function normalizeHost(host: string): string {
  return String(host || '').replace(/^www\./, '').toLowerCase()
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return normalizeHost(new URL(url).hostname)
  } catch {
    return null
  }
}

export function isKnownBoardHost(hostOrUrl: string | null | undefined): boolean {
  const host = String(hostOrUrl || '')
  if (!host) return false

  const normalized = host.includes('://') ? hostOf(host) : normalizeHost(host)
  if (!normalized) return false
  // The host itself or any subdomain of it (uk.whatjobs.com, ca.indeed.com), never a look-alike (indeedsoftware.dev).
  for (const known of KNOWN_BOARD_HOSTS) {
    if (normalized === known || normalized.endsWith(`.${known}`)) return true
  }
  return false
}

export function boardSourceToHost(source: string | null | undefined): string | null {
  const normalized = String(source || '').replace(/^board:/, '').trim().toLowerCase()
  if (!normalized) return null
  return BOARD_SOURCE_HOSTS[normalized] ?? null
}
