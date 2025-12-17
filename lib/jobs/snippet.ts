// lib/jobs/snippet.ts

/**
 * Job card snippet rules:
 * - Must describe the ROLE (not the company).
 * - Avoid company mission/about/founded boilerplate.
 * - Prefer AI snippet; else extract 1–2 sentences from descriptionHtml.
 * - Handle escaped HTML (&lt;div&gt;...) by decoding entities first.
 */

function decodeEntities(s: string): string {
  return (s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanText(input: string): string {
  // decode first so "&lt;div&gt;" becomes "<div>" and can be stripped
  const decoded = decodeEntities(input || '')
  return stripHtml(decoded).replace(/\s+/g, ' ').trim()
}

function looksLikeCompanyBio(text: string): boolean {
  const t = (text || '').toLowerCase()
  return (
    t.includes('was founded') ||
    t.includes('founded in') ||
    t.includes('our mission') ||
    t.includes('we believe') ||
    t.includes('about us') ||
    t.includes('who we are') ||
    t.includes('join our team') ||
    t.includes('headquartered') ||
    (t.includes('at ') && t.includes(' we '))
  )
}

function firstSentences(text: string, maxChars = 180): string | null {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null

  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  const combined = (parts[0] || '') + (parts[1] ? ' ' + parts[1] : '')
  const out = combined.slice(0, maxChars).trim()

  if (looksLikeCompanyBio(out)) return null

  // ✅ allow shorter snippets if role-focused
  return out.length >= 30 ? out : null
}


export function getJobCardSnippet(job: any): string | null {
  const one = typeof job?.aiOneLiner === "string" ? job.aiOneLiner.trim() : ""
  if (one) {
    const cleanedOne = cleanText(one)
    if (cleanedOne.length >= 30 && !looksLikeCompanyBio(cleanedOne)) {
      return cleanedOne.slice(0, 140).trim()
    }
  }

  const ai = typeof job?.aiSnippet === "string" ? job.aiSnippet.trim() : ""
  if (ai) {
    const cleanedAi = cleanText(ai)
    if (cleanedAi.length >= 60 && !looksLikeCompanyBio(cleanedAi)) {
      return cleanedAi.slice(0, 200).trim()
    }
  }

  const html = typeof job?.descriptionHtml === "string" ? job.descriptionHtml : ""
  if (!html) return null

  return firstSentences(cleanText(html))
}

export function buildSnippetFromJob(input: {
  title: string
  descriptionHtml?: string
  descriptionText?: string
}): string {
  const html = input.descriptionHtml || ''
  const txt = input.descriptionText || ''
  const base = (html && cleanText(html)) || txt || ''
  const s = firstSentences(base, 220) || ''
  return decodeEntities(s).trim()
}
