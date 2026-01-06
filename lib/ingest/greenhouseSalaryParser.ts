// lib/ingest/greenhouseSalaryParser.ts
// Parses salary from Greenhouse job description HTML

import type { SalaryInterval } from '../normalizers/salary'

export interface ParsedSalary {
  min: number
  max: number
  currency: string | null
  interval: SalaryInterval
}

/**
 * Decode HTML entities
 */
function decodeHtml(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
}

/**
 * Strip HTML tags and collapse whitespace for safer parsing.
 */
function htmlToText(html: string): string {
  return (
    html
      // preserve <br> as line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      // remove tags
      .replace(/<[^>]+>/g, ' ')
      // normalize whitespace
      .replace(/[ \t\r\f\v]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\s+\n/g, '\n')
      .trim()
  )
}

/**
 * Parse salary from Greenhouse job description HTML
 *
 * Greenhouse does not reliably provide structured salary fields in the public API;
 * compensation is typically embedded in `content` HTML and varies widely by company.
 */
export function parseGreenhouseSalary(input: {
  html: string | null | undefined
  locationText?: string | null
  countryCode?: string | null
}): ParsedSalary | null {
  const html = input.html
  if (!html) return null

  const decoded = decodeHtml(html)
  const text = htmlToText(decoded)

  // 1) Legacy: pay-range div containing salary spans (most structured when present).
  // Example:
  //   <div class="pay-range"><span>$230,000</span> ... <span>$300,000 USD</span></div>
  const legacy = decoded.match(
    /pay-range[\s\S]{0,1200}?<span>\s*(US\$|A\$|C\$|NZ\$|S\$|[£$€₹])\s*([\d.,]+)\s*<\/span>[\s\S]{0,1200}?<span>\s*(US\$|A\$|C\$|NZ\$|S\$|[£$€₹])?\s*([\d.,]+)\s*(USD|EUR|GBP|AUD|CAD|NZD|SGD|CHF|INR)?\s*<\/span>/i,
  )

  if (legacy) {
    const symbol = legacy[1]
    const minStr = legacy[2]
    const maxStr = legacy[4]
    const currencyCode = legacy[5]

    const min = parseMoneyAmount(minStr)
    const max = parseMoneyAmount(maxStr)

    const currency =
      normalizeCurrencyCode(currencyCode) ??
      inferCurrencyFromSymbolOrLocation(symbol, input.locationText ?? null, input.countryCode ?? null)

    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) return null

    return { min, max, currency, interval: inferIntervalFromContext(decoded, Math.max(min, max)) }
  }

  const compSnippet = extractCompensationSnippet(text) ?? text.slice(0, 2500)

  // 2) Match common pay/salary formats in the compensation snippet (avoids scanning full HTML).
  return parseRangeFromText(compSnippet, input.locationText ?? null, input.countryCode ?? null)
}

function normalizeCurrencyCode(v: string | null | undefined): string | null {
  if (!v) return null
  const code = String(v).trim().toUpperCase()
  if (!code) return null
  const allowed = new Set([
    'USD',
    'EUR',
    'GBP',
    'AUD',
    'CAD',
    'NZD',
    'SGD',
    'CHF',
    'INR',
    'SEK',
    'NOK',
    'DKK',
  ])
  return allowed.has(code) ? code : null
}

function parseMoneyAmount(raw: string): number {
  const s = String(raw ?? '').trim()
  if (!s) return NaN

  const lower = s.toLowerCase()
  const hasK = /\bk\b/.test(lower) || /k$/.test(lower)
  const hasM = /\bm\b/.test(lower) || /m$/.test(lower)

  // Remove currency symbols/codes and keep digits, commas, dots
  const cleaned = lower.replace(/[^0-9.,]/g, '')
  if (!cleaned) return NaN

  // If both comma and dot exist, assume comma is thousands separator.
  // Otherwise, treat comma as thousands and dot as decimal.
  const normalized = cleaned.includes('.') && cleaned.includes(',')
    ? cleaned.replace(/,/g, '')
    : cleaned.replace(/,/g, '')

  const n = parseFloat(normalized)
  if (!Number.isFinite(n)) return NaN

  if (hasM) return n * 1_000_000
  if (hasK) return n * 1_000
  return n
}

function inferCurrencyFromSymbolOrLocation(
  symbol: string | null | undefined,
  locationText: string | null,
  countryCode: string | null,
): string | null {
  const sym = String(symbol ?? '').trim()
  if (sym === '£') return 'GBP'
  if (sym === '€') return 'EUR'
  if (sym === '₹') return 'INR'
  if (sym === 'A$' || sym === 'AU$') return 'AUD'
  if (sym === 'C$' || sym === 'CA$') return 'CAD'
  if (sym === 'NZ$') return 'NZD'
  if (sym === 'S$' || sym === 'SG$') return 'SGD'
  if (sym === 'US$') return 'USD'

  const cc = String(countryCode ?? '').trim().toUpperCase()
  if (cc === 'US') return 'USD'
  if (cc === 'CA') return 'CAD'
  if (cc === 'AU') return 'AUD'
  if (cc === 'NZ') return 'NZD'
  if (cc === 'SG') return 'SGD'
  if (cc === 'GB' || cc === 'UK') return 'GBP'
  if (cc === 'DE' || cc === 'FR' || cc === 'NL' || cc === 'ES' || cc === 'PT' || cc === 'IE' || cc === 'IT' || cc === 'AT' || cc === 'BE' || cc === 'FI' || cc === 'LU') return 'EUR'

  const loc = String(locationText ?? '').toLowerCase()
  if (/\b(canada|toronto|vancouver|montreal|ottawa)\b/.test(loc)) return 'CAD'
  if (/\b(australia|sydney|melbourne|brisbane|perth)\b/.test(loc)) return 'AUD'
  if (/\b(new zealand|auckland|wellington)\b/.test(loc)) return 'NZD'
  if (/\b(singapore)\b/.test(loc)) return 'SGD'
  if (/\b(united kingdom|london|england|scotland|wales|uk)\b/.test(loc)) return 'GBP'
  if (/\b(united states|usa|u\.s\.|us)\b/.test(loc)) return 'USD'

  // Common US state pattern: "City, TX" etc. (avoid matching ", CA" as Canada)
  if (/[,\s]\b(AL|AK|AZ|AR|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV)\b/i.test(locationText ?? '')) {
    return 'USD'
  }

  // If it was a "$" salary, default to USD to reduce unknown_currency fallout.
  if (sym === '$' || sym === '') return 'USD'

  return null
}

function extractCompensationSnippet(text: string): string | null {
  const t = String(text ?? '')
  if (!t) return null

  // Prefer specific headers to avoid catching unrelated "pay" words.
  const preferred = [
    /(compensation and benefits)\b/i,
    /(pay\s*range)\b/i,
    /(salary\s*range)\b/i,
    /(base\s*salary)\b/i,
    /(compensation)\b/i,
  ]

  for (const re of preferred) {
    const m = re.exec(t)
    if (!m || m.index == null) continue
    const start = Math.max(0, m.index - 120)
    const end = Math.min(t.length, start + 1800)
    return t.slice(start, end)
  }

  // Fallback: explicit labels with punctuation.
  const label = /(salary|pay)\s*[:\-]/i.exec(t)
  if (!label || label.index == null) return null
  const start = Math.max(0, label.index - 120)
  const end = Math.min(t.length, start + 1400)
  return t.slice(start, end)
}

function parseRangeFromText(
  snippet: string,
  locationText: string | null,
  countryCode: string | null,
): ParsedSalary | null {
  const s = String(snippet ?? '')
  if (!s) return null

  const currencyCodes =
    '(USD|EUR|GBP|AUD|CAD|NZD|SGD|CHF|INR|SEK|NOK|DKK)'
  const sym = '(US\\$|A\\$|C\\$|NZ\\$|S\\$|[£$€₹])'
  const amt = '([\\d][\\d,]*(?:\\.\\d+)?\\s*[kKmM]?)'
  const intervalRe =
    '(?<interval>hour|hr|h|day|week|month|year|yr|annum|annual|annually|yearly|monthly|weekly|daily|hourly)?'

  const keyword = '(?:pay\\s*range|salary\\s*range|compensation|base\\s*salary|salary|pay)'

  const rangeWithKeyword = new RegExp(
    `${keyword}\\s*[:\\-]?\\s*(?<sym1>${sym})?\\s*(?<a>${amt})\\s*(?:-|–|—|to)\\s*(?<sym2>${sym})?\\s*(?<b>${amt})\\s*(?<code>${currencyCodes})?\\s*(?:\\/|per\\s*)?\\s*${intervalRe}`,
    'ig',
  )
  const rangeWithMoney = new RegExp(
    `(?<sym1>${sym})\\s*(?<a>${amt})\\s*(?:-|–|—|to)\\s*(?<sym2>${sym})?\\s*(?<b>${amt})\\s*(?<code>${currencyCodes})?\\s*(?:\\/|per\\s*)?\\s*${intervalRe}`,
    'ig',
  )
  const singleWithKeyword = new RegExp(
    `${keyword}\\s*[:\\-]?\\s*(?<sym1>${sym})?\\s*(?<a>${amt})\\s*(?<code>${currencyCodes})?\\s*(?:\\/|per\\s*)?\\s*${intervalRe}`,
    'ig',
  )
  const singleWithMoney = new RegExp(
    `(?<sym1>${sym})\\s*(?<a>${amt})\\s*(?<code>${currencyCodes})?\\s*(?:\\/|per\\s*)?\\s*${intervalRe}`,
    'ig',
  )

  type Candidate = { min: number; max: number; currency: string | null; interval: SalaryInterval; maxAnnual: number }
  const candidates: Candidate[] = []

  const normalizeIntervalToken = (token: string | null | undefined): SalaryInterval | null => {
    const t = String(token ?? '').toLowerCase().trim()
    if (!t) return null
    if (t === 'h' || t === 'hr' || t === 'hour' || t === 'hourly') return 'hour'
    if (t === 'day' || t === 'daily') return 'day'
    if (t === 'week' || t === 'weekly') return 'week'
    if (t === 'month' || t === 'monthly') return 'month'
    if (t === 'yr' || t === 'year' || t === 'annum' || t === 'annual' || t === 'annually' || t === 'yearly') return 'year'
    return null
  }

  const addCandidate = (m: RegExpExecArray, isRange: boolean, kind: 'keyword' | 'money') => {
    const g = (m.groups ?? {}) as Record<string, string | undefined>
    const aRaw = g.a
    const bRaw = isRange ? g.b : g.a
    if (!aRaw || !bRaw) return

    const a = parseMoneyAmount(aRaw)
    const b = parseMoneyAmount(bRaw)
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return

    const sym1 = g.sym1 ?? null
    const sym2 = g.sym2 ?? null
    const code = normalizeCurrencyCode(g.code ?? null)

    // Reject candidates that have neither symbol nor currency code; too error-prone.
    if (!code && !sym1 && !sym2) return

    const currency = code ?? inferCurrencyFromSymbolOrLocation(sym1 ?? sym2, locationText, countryCode)

    const ctx = s.slice(
      Math.max(0, (m.index ?? 0) - 60),
      Math.min(s.length, (m.index ?? 0) + (m[0]?.length ?? 0) + 60),
    )
    const interval =
      normalizeIntervalToken(g.interval) ?? inferIntervalFromContext(ctx, Math.max(a, b))

    const ctxLower = ctx.toLowerCase()
    let score = 0
    if (kind === 'keyword') score += 2
    if (/(base\s*salary|salary\s*range|pay\s*range)/.test(ctxLower)) score += 4
    else if (/(compensation)/.test(ctxLower)) score += 2
    else if (/\b(salary|pay)\b/.test(ctxLower)) score += 1

    if (/\b(equity|stock|options|rsu|vesting)\b/.test(ctxLower)) score -= 4
    if (/\b(bonus|commission|ote|on[-\s]?target|variable)\b/.test(ctxLower)) score -= 3
    if (/\b(signing)\b/.test(ctxLower)) score -= 2

    const lo = Math.min(a, b)
    const hi = Math.max(a, b)

    const factor =
      interval === 'hour'
        ? 2080
        : interval === 'day'
          ? 260
          : interval === 'week'
            ? 52
            : interval === 'month'
              ? 12
              : 1

    // Prefer high-confidence salary lines over random $-numbers.
    const maxAnnual = hi * factor
    if (maxAnnual <= 0) return

    // Attach score implicitly via maxAnnual: keep a little separation using a weighted sort key.
    // We'll still sort by explicit score to avoid picking equity/bonuses.
    ;(candidates as any).push({ min: lo, max: hi, currency, interval, maxAnnual, __score: score })
  }

  for (const [re, isRange, kind] of [
    [rangeWithKeyword, true, 'keyword'],
    [rangeWithMoney, true, 'money'],
    [singleWithKeyword, false, 'keyword'],
    [singleWithMoney, false, 'money'],
  ] as const) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) {
      addCandidate(m, isRange, kind)
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }

  if (candidates.length === 0) return null
  const best = [...(candidates as any as Array<Candidate & { __score: number }>)].sort(
    (a, b) => b.__score - a.__score || b.maxAnnual - a.maxAnnual,
  )[0]
  return { min: best.min, max: best.max, currency: best.currency, interval: best.interval }
}

function inferIntervalFromContext(context: string, maxAmount: number): SalaryInterval {
  const s = String(context ?? '').toLowerCase()

  if (/(\/\s*(hour|hr|h)\b|\bper\s*hour\b|\bhourly\b)/.test(s)) return 'hour'
  if (/(\/\s*day\b|\bper\s*day\b|\bdaily\b)/.test(s)) return 'day'
  if (/(\/\s*week\b|\bper\s*week\b|\bweekly\b)/.test(s)) return 'week'
  if (/(\/\s*month\b|\bper\s*month\b|\bmonthly\b)/.test(s)) return 'month'
  if (/(\/\s*(year|yr)\b|\bper\s*(year|annum)\b|\bannually\b|\bannual\b|\byearly\b)/.test(s)) return 'year'

  // If not specified, default to yearly. (Most high salaries are annual; prevents accidental hourly.)
  if (Number.isFinite(maxAmount) && maxAmount >= 1000) return 'year'
  return 'year'
}
