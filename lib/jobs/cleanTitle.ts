// Job titles as a person would write them: without "---" separator chains, the job's own city repeated, or pay typed
// into the title (owner's choice, 2026-11-24: "clean titles like Attorney---…---$120k-$180k"). Live examples: freehire
// passes LinkedIn postings by Jobot through as "Attorney---Commercial Real Estate---Charlotte---$120k-$180k"; others
// end "(150K-200K)" or "Los Angeles 160K". The title shows on the job page (H1, <title>) and in its JobPosting, so this
// is an SEO change: it is precise rather than thorough, and a title it cannot make better is returned as it was.

// A pay amount: "$120k", "$120,000", "120K", "$1.2M"; with an optional range and "+" / "/yr".
const AMOUNT = String.raw`\$?\d{2,3}(?:[.,]\d{3})*(?:\.\d+)?\s?[kKmM]?`
const PAY = String.raw`(?:up to\s+)?${AMOUNT}(?:\s?(?:-|–|to)\s?${AMOUNT})?\+?(?:\s?(?:\/\s?(?:yr|year)|per year|a year|base|DOE))?`
/** A whole segment that is only pay. A bare number needs a "$" or a "k" to count ("2025652" is a requisition id). */
const PAY_ONLY = new RegExp(String.raw`^${PAY}$`, 'i')
const HAS_PAY_MARK = /\$|\d\s?[kKmM]\b/

function isPay(segment: string): boolean {
  const s = segment.trim()
  return PAY_ONLY.test(s) && HAS_PAY_MARK.test(s)
}

/** The places a location string names, lower case ("Charlotte, NC" -> charlotte, nc). */
function placeNames(location: string | null | undefined): Set<string> {
  return new Set(
    (location ?? '')
      .split(/[,;/|]/)
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length >= 2),
  )
}

export function cleanJobTitle(title: string, opts: { location?: string | null } = {}): string {
  const original = title
  let t = title.replace(/\s+/g, ' ').trim()

  // 1. "A---B---City---$pay": keep the parts that are neither pay nor the job's own place, joined with " - ".
  if (/-{3,}/.test(t)) {
    const places = placeNames(opts.location)
    const parts = t
      .split(/\s*-{3,}\s*/)
      .map((p) => p.trim())
      .filter((p) => p && !isPay(p) && !places.has(p.toLowerCase()))
    if (parts.length > 0) t = parts.join(' - ')
  }

  // 2. Pay in brackets: "Staff Engineer - Payments (150K-200K)", "[$180k + equity]".
  t = t.replace(/\s*[([]\s*([^()[\]]*)\s*[)\]]/g, (whole, inner: string) => {
    const core = inner.replace(/\s*\+\s*(?:equity|bonus|benefits|commission)\b.*$/i, '').trim()
    return isPay(core) ? '' : whole
  })

  // 3. Pay at the end, after a separator or a space: "Financial Controller - 100k-140k", "Attorney ... Los Angeles 160K".
  const tail = new RegExp(String.raw`(?:\s*[-–|:,]\s*|\s+)(${PAY})\s*$`, 'i')
  const m = tail.exec(t)
  if (m && isPay(m[1])) t = t.slice(0, m.index)

  t = t.replace(/\s*[-–|:,]\s*$/, '').replace(/\s+/g, ' ').trim()
  // Unless what is left still reads as a title (a word of two letters or more), keep the original. Spacing alone is not a
  // reason to rewrite a title (25 of 1,000 live freehire titles, 2026-11-24, differed only in spacing).
  if (t === original.replace(/\s+/g, ' ').trim()) return original
  return t.length >= 3 && /[A-Za-z]{2,}/.test(t) ? t : original
}
