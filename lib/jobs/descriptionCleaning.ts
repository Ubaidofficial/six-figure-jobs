const LEADING_PRIVACY_PATTERNS = [
  /job applicant privacy notice/i,
  /personal information we collect/i,
  /your privacy choices/i,
  /privacy notice/i,
]

const DESCRIPTION_NOISE_RULES = [
  { id: 'similar_jobs', pattern: /\bsimilar jobs\b/i },
  { id: 'showing_jobs_count', pattern: /\bshowing\s+\d+\s+jobs\b/i },
  { id: 'explore_related_pages', pattern: /\bexplore related pages\b/i },
  { id: 'apply_on_company_site', pattern: /\bapply on the company site\b/i },
  { id: 'jobcopilot_marketing', pattern: /\bmeet jobcopilot\b/i },
  { id: 'stop_applying_marketing', pattern: /\bstop applying\b/i },
  { id: 'remote_jobs_from_companies_like', pattern: /\bremote jobs from companies like\b/i },
  {
    id: 'premium_roles_marketing',
    pattern: /\bpremium roles, verified salaries, no noise\b/i,
  },
] as const

export type JobDescriptionNoiseId = (typeof DESCRIPTION_NOISE_RULES)[number]['id']

export type SanitizedJobDescription = {
  descriptionHtml: string | null
  descriptionText: string | null
  polluted: boolean
  noiseMatches: JobDescriptionNoiseId[]
}

export function decodeJobHtmlEntities(input: string): string {
  return (input || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#xa;/gi, '\n')
    .replace(/&#x0*a;/gi, '\n')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

export function stripJobHtmlTags(input: string): string {
  return (input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanJobDescriptionText(input: string): string {
  const decoded = decodeJobHtmlEntities(input || '').replace(
    /(job applicant privacy notice|personal information we collect|your privacy choices)/gi,
    '$1\n',
  )
  const lines = decoded
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  while (lines.length > 0 && isLeadingPrivacyLine(lines[0])) {
    lines.shift()
  }

  const cleaned = lines.join(' ').replace(/\s+/g, ' ').trim()
  return hasJobDescriptionNoise(cleaned) ? '' : cleaned
}

export function cleanJobDescriptionHtml(input: string): string {
  let html = decodeJobHtmlEntities(input || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()

  let changed = true
  while (changed) {
    const before = html
    html = html
      .replace(/^\s*(?:<p>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/p>\s*)+/i, '')
      .replace(/^\s*<p>\s*([^<]{0,120}(?:job applicant privacy notice|personal information we collect|your privacy choices|privacy notice)[^<]{0,120})\s*<\/p>\s*/i, '')
      .replace(/^\s*([^<\n]{0,120}(?:job applicant privacy notice|personal information we collect|your privacy choices|privacy notice)[^<\n]{0,120})(?:\n|\s*<p>\s*<\/p>\s*)/i, '')
      .trim()
    changed = html !== before
  }

  if (hasJobDescriptionNoise(stripJobHtmlTags(html))) {
    return ''
  }

  return html
}

export function findJobDescriptionNoiseMatches(input: string): JobDescriptionNoiseId[] {
  const normalized = stripJobHtmlTags(decodeJobHtmlEntities(input || ''))
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return []

  return DESCRIPTION_NOISE_RULES.filter((rule) => rule.pattern.test(normalized)).map(
    (rule) => rule.id,
  )
}

export function hasJobDescriptionNoise(input: string): boolean {
  return findJobDescriptionNoiseMatches(input).length > 0
}

export function sanitizeJobDescriptionFields(
  descriptionHtml: string | null | undefined,
  descriptionText: string | null | undefined,
): SanitizedJobDescription {
  const rawHtml = String(descriptionHtml || '').trim()
  const rawText = String(descriptionText || '').trim()

  const htmlMatches = rawHtml ? findJobDescriptionNoiseMatches(rawHtml) : []
  const textMatches = rawText ? findJobDescriptionNoiseMatches(rawText) : []

  const cleanedHtml = rawHtml ? cleanJobDescriptionHtml(rawHtml) : ''
  const cleanedText = rawText ? cleanJobDescriptionText(rawText) : ''

  const noiseMatches = Array.from(new Set([...htmlMatches, ...textMatches]))
  const polluted =
    noiseMatches.length > 0 &&
    ((!cleanedHtml && htmlMatches.length > 0) || (!cleanedText && textMatches.length > 0))

  return {
    descriptionHtml: cleanedHtml || null,
    descriptionText: cleanedText || (cleanedHtml ? stripJobHtmlTags(cleanedHtml) : null),
    polluted,
    noiseMatches,
  }
}

function isLeadingPrivacyLine(line: string): boolean {
  const normalized = line.replace(/[^a-z\s]/gi, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) return true
  return LEADING_PRIVACY_PATTERNS.some((pattern) => pattern.test(normalized))
}
