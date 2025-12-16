// lib/jobs/snippet.ts

/**
 * Decode common HTML entities safely.
 * Minimal + deterministic.
 */
export function decodeEntities(s: string): string {
  return (s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    )
}

/**
 * Strip HTML tags (used only for fallback paths).
 */
export function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]*>/g, ' ')
}

/**
 * Normalize text:
 * - decode entities
 * - strip tags
 * - collapse whitespace
 */
export function cleanText(s: string): string {
  return stripHtml(decodeEntities(s))
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateText(str: string, maxChars: number): string {
  const s = (str || '').trim()
  if (!s) return ''
  if (s.length <= maxChars) return s

  const truncated = s.slice(0, maxChars)
  const lastDot = truncated.lastIndexOf('.')
  const lastSpace = truncated.lastIndexOf(' ')
  const cutoff =
    lastDot > maxChars * 0.6 ? lastDot + 1 : lastSpace > 0 ? lastSpace : maxChars

  return truncated.slice(0, cutoff).trimEnd() + ' …'
}

function coerceJsonObject(raw: unknown): any | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    try {
      const parsed = JSON.parse(s)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Canonical job-card snippet selector.
 *
 * Priority (STRICT):
 * 1) aiSnippet              (best, curated)
 * 2) aiSummaryJson.*        (summary / shortSummary / oneLiner / snippet)
 * 3) descriptionHtml        (cleaned)
 * 4) description/body/snippet (cleaned)
 *
 * Deterministic, read-only, UI-safe.
 */
export function getJobCardSnippet(job: any): string | null {
  // 1) AI curated snippet
  if (typeof job?.aiSnippet === 'string' && job.aiSnippet.trim()) {
    return truncateText(job.aiSnippet.trim(), 240)
  }

  // 2) AI summary JSON (object OR string)
  const obj = coerceJsonObject(job?.aiSummaryJson)
  const summary =
    obj?.summary || obj?.shortSummary || obj?.oneLiner || obj?.snippet

  if (typeof summary === 'string' && summary.trim()) {
    return truncateText(summary.trim(), 240)
  }

  // 3) Legacy HTML description (cleaned)
  if (typeof job?.descriptionHtml === 'string' && job.descriptionHtml.trim()) {
    const cleaned = cleanText(job.descriptionHtml)
    return cleaned ? truncateText(cleaned, 240) : null
  }

  // 4) Legacy plaintext fallbacks (cleaned)
  const raw =
    (typeof job?.description === 'string' && job.description) ||
    (typeof job?.body === 'string' && job.body) ||
    (typeof job?.snippet === 'string' && job.snippet) ||
    ''

  const cleaned = cleanText(String(raw))
  return cleaned ? truncateText(cleaned, 240) : null
}
