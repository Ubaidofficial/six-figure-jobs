// lib/jobs/snippet.ts

/**
 * Job card snippet rules:
 * - Must describe the ROLE (not the company).
 * - Never fallback to company mission/about/founded boilerplate.
 * - Prefer AI snippet; else extract 1-2 sentences from descriptionHtml.
 */

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeCompanyBio(text: string): boolean {
  const t = (text || '').toLowerCase()
  return (
    t.includes('was founded') ||
    t.includes('our mission') ||
    t.includes('we believe') ||
    t.includes('about us') ||
    (t.includes('at ') && t.includes(' we ')) ||
    t.includes('join our team') ||
    t.includes('who we are')
  )
}

function firstSentences(text: string, maxChars = 180): string | null {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null

  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  const combined = (parts[0] || '') + (parts[1] ? ' ' + parts[1] : '')
  const out = combined.slice(0, maxChars).trim()

  if (out.length < 60) return null
  if (looksLikeCompanyBio(out)) return null
  return out
}

export function getJobCardSnippet(job: any): string | null {
  const ai = typeof job?.aiSnippet === 'string' ? job.aiSnippet.trim() : ''
  if (ai && ai.length >= 60 && !looksLikeCompanyBio(ai)) {
    return ai.slice(0, 200).trim()
  }

  const html = typeof job?.descriptionHtml === 'string' ? job.descriptionHtml : ''
  if (!html) return null

  const raw = stripHtml(html)
  return firstSentences(raw)
}
