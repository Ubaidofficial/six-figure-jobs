const LEADING_PRIVACY_PATTERNS = [
  /job applicant privacy notice/i,
  /personal information we collect/i,
  /your privacy choices/i,
  /privacy notice/i,
]

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

  return lines.join(' ').replace(/\s+/g, ' ').trim()
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

  return html
}

function isLeadingPrivacyLine(line: string): boolean {
  const normalized = line.replace(/[^a-z\s]/gi, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) return true
  return LEADING_PRIVACY_PATTERNS.some((pattern) => pattern.test(normalized))
}
