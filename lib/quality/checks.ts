// The quality checks the daily snapshot runs (docs/QUALITY_AGENTS_PLAN.md). Each counts LISTED jobs (the jobs a visitor
// can find: buildWhere in lib/jobs/queryJobs.ts) that break one rule, with a few examples. Pure functions over rows the
// snapshot reads, so they are tested without a database. The first five are scripts/audit-data-quality.ts's invariants
// (that script still fails the daily data-quality run); the rest measure what visitors and Google see.
import { titleProblems } from '../admin/reviewQueue'
import { isAggregatorApplyUrl, unwrapRedirectUrl } from '../jobs/applyUrl'
import { countriesFromText } from '../location/jobLocation'

export type Area = 'data' | 'filters' | 'seo' | 'review'
export type Severity = 'high' | 'medium' | 'low'

export type CheckRow = {
  id: string
  title: string
  source: string
  applyUrl: string | null
  salaryMin: bigint | number | null
  salaryMax: bigint | number | null
  salaryCurrency: string | null
  salaryValidated: boolean | null
  roleSlug: string | null
  countryCode: string | null
  remoteMode: string | null
  companyId: string | null
  locationRaw: string | null
}

export type CheckResult = {
  key: string
  area: Area
  severity: Severity
  title: string
  count: number
  /** Out of how many jobs the rule applies to. */
  of: number
  sample: Array<{ id: string; text: string }>
}

const SAMPLE = 5

// Words that name no single place: a remote job described only by these (or by several countries) has no country by
// rule (lib/ingest/index.ts processLocation: remote jobs never take one from a city or the pay currency), so it is not
// a missing country. Found 2026-11-25: 312 listed jobs at plain "Remote", 82 at "Remote / Worldwide", others at "EMEA".
const NO_SINGLE_PLACE = /\b(?:remote|job|jobs|worldwide|global|globally|anywhere|international|any location|location|work from home|wfh|distributed|emea|apac|apj|latam|namer|amer|americas|europe|european union|eu|asia|nordics|dach|benelux|middle east|africa|oceania|anz|north america|south america|in|the|and|or|only)\b/g

/** A remote job whose location names no single place: no country is right for it (pure). */
export function remoteWithoutSinglePlace(r: Pick<CheckRow, 'remoteMode' | 'locationRaw'>): boolean {
  if (r.remoteMode !== 'remote') return false
  const text = (r.locationRaw ?? '').toLowerCase()
  if (countriesFromText(text).length >= 2) return true
  return text.replace(NO_SINGLE_PLACE, ' ').replace(/[^a-z]+/g, '') === ''
}
const RETIREMENT_PLAN_VALUES = new Set([401000, 403000, 457000])
const num = (v: bigint | number | null) => (v == null ? null : Number(v))

type Def = { key: string; area: Area; severity: Severity; title: string; applies?: (r: CheckRow) => boolean; bad: (r: CheckRow) => string | null }

const DEFS: Def[] = [
  {
    key: 'apply_url_aggregator_or_redirect',
    area: 'data',
    severity: 'high',
    title: 'Apply link goes to an aggregator or an ad redirect, not the employer',
    applies: (r) => Boolean(r.applyUrl),
    bad: (r) => (isAggregatorApplyUrl(r.applyUrl as string, r.source) || unwrapRedirectUrl(r.applyUrl as string) !== r.applyUrl ? `${r.applyUrl}` : null),
  },
  {
    key: 'salary_retirement_plan_noise',
    area: 'data',
    severity: 'high',
    title: 'Pay is a retirement plan number (401k, 403b, 457b)',
    applies: (r) => r.salaryValidated === true,
    bad: (r) => (RETIREMENT_PLAN_VALUES.has(num(r.salaryMin) ?? -1) || RETIREMENT_PLAN_VALUES.has(num(r.salaryMax) ?? -1) ? `${r.salaryMin}-${r.salaryMax}` : null),
  },
  {
    key: 'salary_inverted_range',
    area: 'data',
    severity: 'high',
    title: 'Pay range minimum above its maximum',
    applies: (r) => r.salaryValidated === true,
    bad: (r) => (num(r.salaryMin) != null && num(r.salaryMax) != null && num(r.salaryMin)! > num(r.salaryMax)! ? `${r.salaryMin} > ${r.salaryMax}` : null),
  },
  {
    key: 'salary_validated_without_currency',
    area: 'data',
    severity: 'high',
    title: 'Validated pay with no currency',
    applies: (r) => r.salaryValidated === true,
    bad: (r) => ((r.salaryMin != null || r.salaryMax != null) && !r.salaryCurrency ? `${r.salaryMin}-${r.salaryMax}` : null),
  },
  {
    key: 'missing_role',
    area: 'filters',
    severity: 'medium',
    title: 'No role, so the job is in no role filter or role page',
    bad: (r) => (r.roleSlug ? null : r.title),
  },
  {
    key: 'missing_country',
    area: 'filters',
    severity: 'medium',
    title: 'No country though the location names a place, so the job is in no country filter, page or remote-region list',
    // Remote jobs at "Remote", "Worldwide", "EMEA" or several countries have no country by rule (2026-11-25).
    applies: (r) => !remoteWithoutSinglePlace(r),
    bad: (r) => (r.countryCode ? null : `${r.title} · "${r.locationRaw ?? ''}"`),
  },
  {
    key: 'work_mode_not_stated',
    area: 'filters',
    severity: 'low',
    title: 'Work arrangement (remote / hybrid / on-site) not known',
    bad: (r) => (r.remoteMode ? null : r.title),
  },
  {
    key: 'no_company_record',
    area: 'seo',
    severity: 'low',
    title: 'Not linked to a company record (no company page, logo or profile)',
    bad: (r) => (r.companyId ? null : r.title),
  },
  {
    key: 'odd_title',
    area: 'seo',
    severity: 'medium',
    title: 'Title with "---", pay in it, or over 110 characters (shown as is in Google)',
    bad: (r) => {
      const p = titleProblems(r.title)
      return p.length ? `${r.title} (${p.join(', ')})` : null
    },
  },
]

/** Every check over the listed jobs, plus duplicate apply links (a count across jobs, not a per-job rule). */
export function runChecks(rows: CheckRow[]): CheckResult[] {
  const out: CheckResult[] = DEFS.map((d) => {
    const scope = d.applies ? rows.filter(d.applies) : rows
    const sample: CheckResult['sample'] = []
    let count = 0
    for (const r of scope) {
      const text = d.bad(r)
      if (text == null) continue
      count++
      if (sample.length < SAMPLE) sample.push({ id: r.id, text: text.slice(0, 200) })
    }
    return { key: d.key, area: d.area, severity: d.severity, title: d.title, count, of: scope.length, sample }
  })

  const byApply = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.applyUrl) continue
    const k = r.applyUrl.trim()
    byApply.set(k, [...(byApply.get(k) ?? []), r.id])
  }
  const dups = [...byApply.entries()].filter(([, ids]) => ids.length > 1)
  out.splice(4, 0, {
    key: 'duplicate_apply_url',
    area: 'data',
    severity: 'medium',
    title: 'Two or more listed jobs share one apply link (likely duplicates)',
    count: dups.reduce((n, [, ids]) => n + ids.length - 1, 0),
    of: rows.filter((r) => r.applyUrl).length,
    sample: dups.slice(0, SAMPLE).map(([url, ids]) => ({ id: ids[0], text: `${ids.length}× ${url}`.slice(0, 200) })),
  })
  return out
}

/** Share of rows with a value, as a whole percentage (0 when there are none). */
export function fillRate(rows: CheckRow[], field: 'roleSlug' | 'countryCode' | 'remoteMode' | 'companyId'): number {
  return rows.length ? Math.round((rows.filter((r) => r[field]).length / rows.length) * 1000) / 10 : 0
}
