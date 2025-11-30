// lib/jobs/salary.ts
// Unified salary helpers for JobCard, JobPage, CompanyPage, Slices, SEO, etc.

export type SalaryJob = {
  minAnnual?: number | bigint | null
  maxAnnual?: number | bigint | null
  currency?: string | null
  salaryMin?: number | bigint | null
  salaryMax?: number | bigint | null
  salaryCurrency?: string | null
  salaryRaw?: string | null
}

/* -------------------------------------------------------------
   Currency symbols
------------------------------------------------------------- */
function getCurrencySymbol(code?: string | null) {
  if (!code) return '$'
  const c = code.toUpperCase()

  switch (c) {
    case 'USD': return '$'
    case 'EUR': return '€'
    case 'GBP': return '£'
    case 'AUD': return 'A$'
    case 'CAD': return 'C$'
    case 'SGD': return 'S$'
    case 'JPY': return '¥'
    case 'INR': return '₹'
    default: return `${c} `
  }
}

/* -------------------------------------------------------------
   Convert bigint → number safely
------------------------------------------------------------- */
function toNum(v: number | bigint | null | undefined): number | null {
  if (v == null) return null
  try {
    return typeof v === 'bigint' ? Number(v) : v
  } catch {
    return null
  }
}

/* -------------------------------------------------------------
   Compact number formatter → "120k"
------------------------------------------------------------- */
function fmtCompact(v: number) {
  if (!Number.isFinite(v)) return null
  if (v >= 1000) return `${Math.round(v / 1000)}k`
  return String(v)
}

/* -------------------------------------------------------------
   Build salary text
------------------------------------------------------------- */
export function buildSalaryText(job: SalaryJob): string | null {
  // Prefer normalized annual fields
  let min = toNum(job.minAnnual)
  let max = toNum(job.maxAnnual)
  let cur = job.currency

  // If missing → fallback to raw salaryMin/max
  if (!min && !max) {
    min = toNum(job.salaryMin)
    max = toNum(job.salaryMax)
    cur = job.salaryCurrency || cur
  }

  // Clean invalid values
  if (min !== null && (!Number.isFinite(min) || min <= 0)) min = null
  if (max !== null && (!Number.isFinite(max) || max <= 0)) max = null
  if (min && min > 2_000_000) min = null
  if (max && max > 2_000_000) max = null

  const symbol = getCurrencySymbol(cur)
  const f = fmtCompact

  if (min !== null && max !== null) {
    return min === max
      ? `${symbol}${f(min)}/yr`
      : `${symbol}${f(min)}–${symbol}${f(max)}/yr`
  }

  if (min !== null) return `${symbol}${f(min)}+/yr`
  if (max !== null) return `up to ${symbol}${f(max)}/yr`

  // Last fallback to salaryRaw → truncate
  if (job.salaryRaw) {
    return cleanSalaryRaw(job.salaryRaw)
  }

  return null
}

/* -------------------------------------------------------------
   Clean salaryRaw fallback text
------------------------------------------------------------- */
function cleanSalaryRaw(raw: string): string {
  const noHtml = raw.replace(/<\/?[^>]+>/g, '')
  let s = decode(noHtml).trim()
  if (s.length > 80) s = s.slice(0, 77) + '…'
  return s
}

function decode(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
