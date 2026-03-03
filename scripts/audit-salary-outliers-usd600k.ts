import { prisma } from '../lib/prisma'

type FxRates = Record<string, number>

type JobRow = {
  id: string
  title: string | null
  companyName: string | null
  salaryMin: bigint | null
  salaryMax: bigint | null
  salaryCurrency: string | null
  salaryPeriod: string | null
  minAnnual: bigint | null
  maxAnnual: bigint | null
  currency: string | null
  salaryRaw: string | null
  source: string | null
  url: string | null
  applyUrl: string | null
  salaryValidated: boolean | null
  salaryConfidence: number | null
  salarySource: string | null
  salaryParseReason: string | null
}

const USD_THRESHOLD = 600_000
const LOCAL_PREFILTER_MIN = 200_000 // keep query bounded; we filter precisely in JS via FX

function toNumberSafe(v: bigint | null): number | null {
  if (v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n
}

function annualize(amount: number, period: string | null | undefined): number {
  const p = String(period || 'year').toLowerCase()
  if (p === 'year' || p === 'annual' || p === 'annum') return amount
  if (p === 'month' || p === 'monthly') return amount * 12
  if (p === 'week' || p === 'weekly') return amount * 52
  if (p === 'day' || p === 'daily') return amount * 260
  if (p === 'hour' || p === 'hourly') return amount * 2080
  return amount
}

function normalizeCurrency(code: string | null | undefined): string | null {
  const c = String(code || '').trim().toUpperCase()
  if (!c) return null
  if (c === '$') return null
  return c
}

function fmtMoney(amount: number | null, currency: string | null): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  const sym =
    currency === 'USD' ? '$' :
    currency === 'EUR' ? '€' :
    currency === 'GBP' ? '£' :
    currency === 'AUD' ? 'A$' :
    currency === 'CAD' ? 'C$' :
    currency === 'CHF' ? 'CHF ' :
    currency === 'SEK' ? 'SEK ' :
    currency === 'SGD' ? 'S$' :
    currency === 'INR' ? '₹' :
    `${currency || ''} `

  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1000) return `${sym}${Math.round(amount / 1000)}k`
  return `${sym}${Math.round(amount)}`
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()
}

function mdTable(rows: Array<Record<string, string>>, columns: string[]): string {
  const header = `| ${columns.join(' | ')} |`
  const sep = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map((r) => `| ${columns.map((c) => r[c] ?? '').join(' | ')} |`).join('\n')
  return [header, sep, body].join('\n')
}

function percent(part: number, total: number): string {
  if (!total) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

async function fetchFxRatesUsdBase(): Promise<FxRates | null> {
  // Prefer a free, no-auth endpoint.
  // If this fails, we fall back to a small static map.
  const url = 'https://open.er-api.com/v6/latest/USD'
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const json: any = await res.json()
    const rates = json?.rates && typeof json.rates === 'object' ? (json.rates as FxRates) : null
    if (!rates || typeof rates.USD !== 'number') {
      // Some providers omit USD in the map; inject it.
      if (rates) rates.USD = 1
    }
    return rates
  } catch {
    return null
  }
}

function fallbackFxRates(): FxRates {
  // Approximate USD base rates (only used if fetch fails).
  return {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.52,
    CHF: 0.90,
    SEK: 10.4,
    SGD: 1.35,
    INR: 83.0,
  }
}

function classifyRawText(raw: string): {
  mentionsEquity: boolean
  mentionsBonus: boolean
  mentionsOTE: boolean
  mentionsHourlyMonthly: boolean
  hasBigNumbers: boolean
} {
  const t = raw.toLowerCase()
  return {
    mentionsEquity: /\b(equity|rsu|rsus|stock|options|option)\b/.test(t),
    mentionsBonus: /\b(bonus|sign[-\s]?on|commission)\b/.test(t),
    mentionsOTE: /\bote\b/.test(t) || /\bon[-\s]?target earnings\b/.test(t),
    mentionsHourlyMonthly: /\b(per\s*hour|hourly|\/\s*hour|per\s*month|monthly|\/\s*month)\b/.test(t),
    hasBigNumbers: /\b\d{7,}\b/.test(t) || /\b\d{1,3}(?:,\d{3}){2,}\b/.test(t),
  }
}

function extractTitleKeywords(title: string): string[] {
  const stop = new Set([
    'and','or','the','a','an','of','for','to','in','on','with','at','by',
    'senior','sr','staff','principal','lead','director','vp','head','ii','iii','iv',
    'engineer','engineering','manager','product','software',
  ])
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !stop.has(w))
    .slice(0, 25)
}

async function main() {
  const started = new Date().toISOString()

  const fx = (await fetchFxRatesUsdBase()) ?? fallbackFxRates()
  fx.USD = 1

  const rows = await prisma.$queryRaw<JobRow[]>`
    SELECT
      j.id,
      j.title,
      COALESCE(c.name, j.company) AS "companyName",
      j."salaryMin",
      j."salaryMax",
      j."salaryCurrency",
      j."salaryPeriod",
      j."minAnnual",
      j."maxAnnual",
      j.currency,
      j."salaryRaw",
      j.source,
      j.url,
      j."applyUrl",
      j."salaryValidated",
      j."salaryConfidence",
      j."salarySource",
      j."salaryParseReason"
    FROM "Job" j
    LEFT JOIN "Company" c ON c.id = j."companyId"
    WHERE
      j."isExpired" = false
      AND (
        (j."minAnnual" IS NOT NULL AND j."minAnnual" >= ${BigInt(LOCAL_PREFILTER_MIN)})
        OR (j."maxAnnual" IS NOT NULL AND j."maxAnnual" >= ${BigInt(LOCAL_PREFILTER_MIN)})
        OR (j."salaryMin" IS NOT NULL AND j."salaryMin" >= ${BigInt(LOCAL_PREFILTER_MIN)})
        OR (j."salaryMax" IS NOT NULL AND j."salaryMax" >= ${BigInt(LOCAL_PREFILTER_MIN)})
      );
  `

  type Outlier = JobRow & {
    currencyCode: string | null
    localMinAnnual: number | null
    localMaxAnnual: number | null
    usdMin: number | null
    usdMax: number | null
    rawFlags: ReturnType<typeof classifyRawText>
  }

  const outliers: Outlier[] = []

  for (const r of rows) {
    const currencyCode = normalizeCurrency(r.currency) ?? normalizeCurrency(r.salaryCurrency)
    if (!currencyCode) continue
    const rate = fx[currencyCode]
    if (!rate || !Number.isFinite(rate) || rate <= 0) continue

    const minAnnual = toNumberSafe(r.minAnnual)
    const maxAnnual = toNumberSafe(r.maxAnnual)

    let localMinAnnual: number | null = minAnnual
    let localMaxAnnual: number | null = maxAnnual

    if (localMinAnnual == null && localMaxAnnual == null) {
      const rawMin = toNumberSafe(r.salaryMin)
      const rawMax = toNumberSafe(r.salaryMax)
      if (rawMin != null) localMinAnnual = annualize(rawMin, r.salaryPeriod)
      if (rawMax != null) localMaxAnnual = annualize(rawMax, r.salaryPeriod)
    }

    if (localMinAnnual == null && localMaxAnnual == null) continue

    const usdMin = localMinAnnual != null ? localMinAnnual / rate : null
    const usdMax = localMaxAnnual != null ? localMaxAnnual / rate : null

    const usdForFilter = usdMin ?? usdMax ?? null
    if (usdForFilter == null || usdForFilter <= USD_THRESHOLD) continue

    outliers.push({
      ...r,
      currencyCode,
      localMinAnnual,
      localMaxAnnual,
      usdMin,
      usdMax,
      rawFlags: classifyRawText(r.salaryRaw || ''),
    })
  }

  outliers.sort((a, b) => (b.usdMin ?? b.usdMax ?? 0) - (a.usdMin ?? a.usdMax ?? 0))

  const top20 = outliers.slice(0, 20)

  // Pattern analysis
  const bySource = new Map<string, number>()
  const byCompany = new Map<string, number>()
  const bySalarySource = new Map<string, number>()
  const byParseReason = new Map<string, number>()
  const byPeriod = new Map<string, number>()
  const titleWords = new Map<string, number>()

  let mentionEquity = 0
  let mentionBonus = 0
  let mentionOte = 0
  let mentionHourlyMonthly = 0
  let hasBigNumbers = 0
  let validated = 0
  let flaggedTooHigh = 0
  let computedFromRawSalaryMin = 0
  let plausibleHigh = 0

  for (const o of outliers) {
    const source = o.source || 'NULL'
    bySource.set(source, (bySource.get(source) || 0) + 1)

    const company = o.companyName || 'NULL'
    byCompany.set(company, (byCompany.get(company) || 0) + 1)

    const ss = o.salarySource || 'none'
    bySalarySource.set(ss, (bySalarySource.get(ss) || 0) + 1)

    const pr = o.salaryParseReason || 'NULL'
    byParseReason.set(pr, (byParseReason.get(pr) || 0) + 1)

    const period = o.salaryPeriod || 'NULL'
    byPeriod.set(period, (byPeriod.get(period) || 0) + 1)

    for (const w of extractTitleKeywords(o.title || '')) {
      titleWords.set(w, (titleWords.get(w) || 0) + 1)
    }

    if (o.rawFlags.mentionsEquity) mentionEquity++
    if (o.rawFlags.mentionsBonus) mentionBonus++
    if (o.rawFlags.mentionsOTE) mentionOte++
    if (o.rawFlags.mentionsHourlyMonthly) mentionHourlyMonthly++
    if (o.rawFlags.hasBigNumbers) hasBigNumbers++
    if (o.salaryValidated === true) validated++
    if (o.salaryValidated !== true && o.salaryParseReason === 'too_high') flaggedTooHigh++
    if (o.minAnnual == null && o.salaryMin != null) computedFromRawSalaryMin++

    const usd = o.usdMin ?? o.usdMax ?? null
    const plausible =
      o.salaryValidated === true &&
      usd != null &&
      usd >= USD_THRESHOLD &&
      usd <= 1_500_000 &&
      !o.rawFlags.mentionsEquity &&
      !o.rawFlags.mentionsBonus
    if (plausible) plausibleHigh++
  }

  const topSources = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topCompanies = Array.from(byCompany.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topWords = Array.from(titleWords.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15)
  const salarySourceDist = Array.from(bySalarySource.entries()).sort((a, b) => b[1] - a[1])
  const parseReasonDist = Array.from(byParseReason.entries()).sort((a, b) => b[1] - a[1])
  const periodDist = Array.from(byPeriod.entries()).sort((a, b) => b[1] - a[1])

  const lines: string[] = []
  lines.push(`# Salary Outliers Audit — > $${USD_THRESHOLD.toLocaleString()} USD equivalent`)
  lines.push(`Generated: ${started}`)
  lines.push('')
  lines.push(`## Summary`)
  lines.push(`- Candidates scanned (prefiltered): ${rows.length}`)
  lines.push(`- Outliers found (> $${USD_THRESHOLD.toLocaleString()} USD equiv): ${outliers.length}`)
  lines.push(`- Outliers with salaryValidated=true: ${validated} (${percent(validated, outliers.length)})`)
  lines.push(`- Outliers flagged as too_high (salaryValidated=false & salaryParseReason=too_high): ${flaggedTooHigh} (${percent(flaggedTooHigh, outliers.length)})`)
  lines.push(`- Outliers computed from raw salaryMin/salaryMax (minAnnual/maxAnnual NULL): ${computedFromRawSalaryMin} (${percent(computedFromRawSalaryMin, outliers.length)})`)
  lines.push(`- Plausible legitimate $600k+ (validated, <=$1.5M, no equity/bonus terms): ${plausibleHigh} (${percent(plausibleHigh, outliers.length)})`)
  lines.push(`- Raw text mentions: equity=${mentionEquity} (${percent(mentionEquity, outliers.length)}), bonus/commission=${mentionBonus} (${percent(mentionBonus, outliers.length)}), OTE=${mentionOte} (${percent(mentionOte, outliers.length)}), hourly/monthly=${mentionHourlyMonthly} (${percent(mentionHourlyMonthly, outliers.length)})`)
  lines.push(`- Raw text has “big numbers” (7+ digits): ${hasBigNumbers} (${percent(hasBigNumbers, outliers.length)})`)
  lines.push('')
  lines.push(`## FX Rates`)
  lines.push(`- Source: ${Object.keys(fx).length > 20 ? 'open.er-api.com (USD base)' : 'fallback static map'}`)
  lines.push(`- Note: USD equivalent computed as: \`USD = localAnnual / fxRate\` where fxRate is “currency units per 1 USD”.`)
  lines.push('')

  lines.push(`## Top 20 Outliers`)
  lines.push(
    mdTable(
      top20.map((o) => {
        const local =
          o.localMinAnnual != null || o.localMaxAnnual != null
            ? `${fmtMoney(o.localMinAnnual, o.currencyCode)}–${fmtMoney(o.localMaxAnnual ?? o.localMinAnnual, o.currencyCode)}/yr`
            : '—'
        const usd =
          o.usdMin != null || o.usdMax != null
            ? `${fmtMoney(o.usdMin, 'USD')}–${fmtMoney(o.usdMax ?? o.usdMin, 'USD')}/yr`
            : '—'
        const raw = mdEscape(String(o.salaryRaw || '').slice(0, 140))
        const src = mdEscape(String(o.source || ''))
        return {
          ID: mdEscape(o.id),
          Title: mdEscape(String(o.title || '')),
          Company: mdEscape(String(o.companyName || '')),
          Salary: mdEscape(`${usd} (${local})`),
          Currency: mdEscape(String(o.currencyCode || '')),
          Source: src,
          'Raw Text': raw || '—',
        }
      }),
      ['ID', 'Title', 'Company', 'Salary', 'Currency', 'Source', 'Raw Text'],
    ),
  )
  lines.push('')

  lines.push(`## Pattern Analysis`)
  lines.push(`### By job.source (top 10)`)
  lines.push(
    mdTable(
      topSources.map(([k, n]) => ({ source: mdEscape(k), outliers: String(n), pct: percent(n, outliers.length) })),
      ['source', 'outliers', 'pct'],
    ),
  )
  lines.push('')
  lines.push(`### By company (top 10)`)
  lines.push(
    mdTable(
      topCompanies.map(([k, n]) => ({ company: mdEscape(k), outliers: String(n), pct: percent(n, outliers.length) })),
      ['company', 'outliers', 'pct'],
    ),
  )
  lines.push('')
  lines.push(`### Salary source breakdown (Job.salarySource)`)
  lines.push(
    mdTable(
      salarySourceDist.map(([k, n]) => ({ salarySource: mdEscape(k), outliers: String(n), pct: percent(n, outliers.length) })),
      ['salarySource', 'outliers', 'pct'],
    ),
  )
  lines.push('')

  lines.push(`### Salary parse reason breakdown (Job.salaryParseReason)`)
  lines.push(
    mdTable(
      parseReasonDist.map(([k, n]) => ({ salaryParseReason: mdEscape(k), outliers: String(n), pct: percent(n, outliers.length) })),
      ['salaryParseReason', 'outliers', 'pct'],
    ),
  )
  lines.push('')

  lines.push(`### Salary period breakdown (Job.salaryPeriod)`)
  lines.push(
    mdTable(
      periodDist.map(([k, n]) => ({ salaryPeriod: mdEscape(k), outliers: String(n), pct: percent(n, outliers.length) })),
      ['salaryPeriod', 'outliers', 'pct'],
    ),
  )
  lines.push('')
  lines.push(`### Common title keywords (top 15)`)
  lines.push(
    mdTable(
      topWords.map(([k, n]) => ({ keyword: mdEscape(k), count: String(n) })),
      ['keyword', 'count'],
    ),
  )
  lines.push('')

  lines.push(`## Notes`)
  lines.push(`- This report uses only DB fields; set \`FETCH_PAGES=1\` to also fetch and scan live job pages for salary text (best-effort).`)
  lines.push('')

  // Optional fetch of job pages (best effort)
  const doFetch = String(process.env.FETCH_PAGES || '') === '1'
  if (doFetch && top20.length) {
    lines.push(`## Page Fetch Samples (best-effort)`)
    lines.push(`- Attempts: ${top20.length} (top 20)`)
    lines.push('')

    const samples: Array<Record<string, string>> = []
    const concurrency = 3
    let idx = 0

    async function worker() {
      while (idx < top20.length) {
        const i = idx++
        const job = top20[i]
        const target = job.url || job.applyUrl
        if (!target) {
          samples.push({ ID: job.id, status: 'no-url', found: '—' })
          continue
        }

        try {
          const controller = new AbortController()
          const t = setTimeout(() => controller.abort(), 12_000)
          const res = await fetch(target, { signal: controller.signal, redirect: 'follow' })
          clearTimeout(t)
          const status = String(res.status)
          const text = await res.text()

          const head = text.slice(0, 200_000) // cap read
          const m =
            head.match(/(\$|€|£|A\$|C\$|CHF|SEK|SGD|INR)\s?\d[\d,.]{2,}/i) ||
            head.match(/\bUSD\s?\d[\d,.]{2,}/i) ||
            head.match(/\bEUR\s?\d[\d,.]{2,}/i) ||
            head.match(/\bGBP\s?\d[\d,.]{2,}/i)

          const found = m ? m[0].slice(0, 80) : 'no-salary-detected'
          samples.push({ ID: job.id, status, found: mdEscape(found) })
        } catch (e: any) {
          samples.push({ ID: job.id, status: 'fetch-error', found: mdEscape(e?.message || String(e)) })
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    lines.push(mdTable(samples.slice(0, 20), ['ID', 'status', 'found']))
    lines.push('')
  }

  process.stdout.write(lines.join('\n') + '\n')
}

main()
  .catch((e) => {
    console.error('[audit-outliers] failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
