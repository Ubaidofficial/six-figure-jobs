/**
 * @jest-environment node
 */
// The daily quality snapshot's checks and findings rules (lib/quality, docs/QUALITY_AGENTS_PLAN.md).
import { fillRate, remoteWithoutSinglePlace, runChecks, type CheckRow } from '../../lib/quality/checks'
import { fetchPrs, findingKeysOf, formatReport, nextFindingState, type PrInfo, type Snapshot } from '../../lib/quality/snapshot'

const row = (over: Partial<CheckRow> = {}): CheckRow => ({
  id: `j${Math.random().toString(36).slice(2, 7)}`,
  title: 'Senior Software Engineer',
  source: 'ats:greenhouse',
  applyUrl: `https://boards.greenhouse.io/acme/jobs/${Math.floor(Math.random() * 1e9)}`,
  salaryMin: BigInt(150_000),
  salaryMax: BigInt(200_000),
  salaryCurrency: 'USD',
  salaryValidated: true,
  roleSlug: 'software-engineer',
  countryCode: 'US',
  remoteMode: 'remote',
  companyId: 'c1',
  locationRaw: 'New York, NY',
  ...over,
})
const count = (rows: CheckRow[], key: string) => runChecks(rows).find((c) => c.key === key)!

describe('remote jobs that name no single place', () => {
  // These have no country by rule, so missing_country does not count them (2026-11-25: "Remote" 312, "Remote / Worldwide" 82).
  it.each(['Remote', 'Remote / Worldwide', 'remote - worldwide', 'EMEA', 'Europe', 'Any Location / Remote', 'Canada; United States', 'Germany,  Ireland,  Spain,  Sweden,  UK', 'NAMER', ''])(
    '"%s"',
    (text) => expect(remoteWithoutSinglePlace({ remoteMode: 'remote', locationRaw: text })).toBe(true),
  )
  it.each([['Boston', 'remote'], ['Remote - Texas', 'remote'], ['Montréal - Remote', 'remote'], ['Remote', 'hybrid'], ['Remote', null]] as const)(
    'counts "%s" (%s)',
    (text, mode) => expect(remoteWithoutSinglePlace({ remoteMode: mode, locationRaw: text })).toBe(false),
  )
  it('missing_country leaves them out of the count and of the total', () => {
    const c = runChecks([row({ countryCode: null, remoteMode: 'remote', locationRaw: 'Remote' }), row({ countryCode: null, remoteMode: 'remote', locationRaw: 'Boston' })])
    expect(c.find((x) => x.key === 'missing_country')).toMatchObject({ count: 1, of: 1 })
  })
})

describe('quality checks', () => {
  it('a clean job breaks no rule', () => {
    expect(runChecks([row()]).every((c) => c.count === 0)).toBe(true)
  })
  it('counts each problem, with examples', () => {
    const rows = [
      row({ id: 'a', salaryMin: BigInt(401000), salaryMax: BigInt(401000) }),
      row({ id: 'b', salaryMin: BigInt(300_000), salaryMax: BigInt(200_000) }),
      row({ id: 'c', salaryCurrency: null }),
      row({ id: 'd', roleSlug: null, countryCode: null, remoteMode: null, companyId: null }),
      row({ id: 'e', title: 'Attorney---Real Estate---Charlotte---$120k-$180k' }),
      row({ id: 'f', applyUrl: 'https://same.example/apply' }),
      row({ id: 'g', applyUrl: 'https://same.example/apply' }),
    ]
    expect(count(rows, 'salary_retirement_plan_noise')).toMatchObject({ count: 1, sample: [{ id: 'a' }] })
    expect(count(rows, 'salary_inverted_range').count).toBe(1)
    expect(count(rows, 'salary_validated_without_currency').count).toBe(1)
    for (const k of ['missing_role', 'missing_country', 'work_mode_not_stated', 'no_company_record']) expect(count(rows, k)).toMatchObject({ count: 1, of: 7 })
    expect(count(rows, 'odd_title').sample[0].text).toContain('“---” separators')
    expect(count(rows, 'duplicate_apply_url')).toMatchObject({ count: 1, sample: [{ text: '2× https://same.example/apply' }] })
  })
  it('pay rules look only at validated pay', () => {
    expect(count([row({ salaryValidated: false, salaryCurrency: null })], 'salary_validated_without_currency')).toMatchObject({ count: 0, of: 0 })
  })
  it('fill rate as a percentage with one decimal', () => {
    expect(fillRate([row(), row({ roleSlug: null }), row()], 'roleSlug')).toBe(66.7)
    expect(fillRate([], 'roleSlug')).toBe(0)
  })
})

const pr = (over: Partial<PrInfo> = {}): PrInfo => ({ url: 'https://github.com/o/r/pull/1', title: 'Fix', body: 'Text\nQuality-Finding: missing_role\n', state: 'open', merged: false, ...over })
const now = new Date('2026-11-25T05:30:00Z')

describe('findings', () => {
  it('reads "Quality-Finding: <key>" lines from a PR body', () => {
    expect(findingKeysOf('Fixes roles.\n\nQuality-Finding: missing_role\nquality-finding: ODD_TITLE')).toEqual(['missing_role', 'odd_title'])
    expect(findingKeysOf('mentions Quality-Finding: missing_role inline')).toEqual([])
    expect(findingKeysOf(null)).toEqual([])
  })
  it('an open PR naming it: "pr"', () => {
    expect(nextFindingState(null, 5, [pr()], 'missing_role', now)).toMatchObject({ status: 'pr', prUrl: 'https://github.com/o/r/pull/1' })
  })
  it('its PR closed unmerged: "wontfix", and it stays so', () => {
    const prev = { status: 'pr', prUrl: 'https://github.com/o/r/pull/1', note: null, fixedAt: null }
    const next = nextFindingState(prev, 5, [pr({ state: 'closed' })], 'missing_role', now)
    expect(next.status).toBe('wontfix')
    expect(nextFindingState(next, 9, [], 'missing_role', now).status).toBe('wontfix')
  })
  it('count zero: fixed; above zero again: open', () => {
    const fixed = nextFindingState({ status: 'open', prUrl: null, note: null, fixedAt: null }, 0, [], 'missing_role', now)
    expect(fixed).toMatchObject({ status: 'fixed', fixedAt: now })
    expect(nextFindingState(fixed, 3, [], 'missing_role', now)).toMatchObject({ status: 'open', fixedAt: null })
  })
  it('a merged PR that left the count above zero reopens it with a note', () => {
    const prev = { status: 'pr', prUrl: 'https://github.com/o/r/pull/1', note: null, fixedAt: null }
    expect(nextFindingState(prev, 4, [pr({ state: 'closed', merged: true })], 'missing_role', now)).toMatchObject({
      status: 'open',
      note: 'Pull request merged, but 4 still match.',
    })
  })
})

describe('reading pull requests', () => {
  it('nothing without a token; recent closed PRs only', async () => {
    expect(await fetchPrs('o/r', undefined)).toEqual([])
    const recent = new Date(Date.now() - 86_400_000).toISOString()
    const fake = jest.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('state=open')
          ? [{ html_url: 'u1', title: 't1', body: 'Quality-Finding: a', state: 'open', merged_at: null, closed_at: null }]
          : [
              { html_url: 'u2', title: 't2', body: null, state: 'closed', merged_at: recent, closed_at: recent },
              { html_url: 'u3', title: 't3', body: null, state: 'closed', merged_at: null, closed_at: '2026-01-01T00:00:00Z' },
            ],
    }))
    const prs = await fetchPrs('o/r', 'token', fake as unknown as typeof fetch)
    expect(prs.map((p) => [p.url, p.state, p.merged])).toEqual([['u1', 'open', false], ['u2', 'closed', true]])
  })
  it('a failed request links nothing and does not throw', async () => {
    expect(await fetchPrs('o/r', 'token', (async () => { throw new Error('down') }) as unknown as typeof fetch)).toEqual([])
  })
})

describe('report', () => {
  it('shows the change since the last snapshot', () => {
    const snap: Snapshot = {
      capturedAt: now,
      version: 1,
      metrics: { listedJobs: 10, pagesUp: 12, fill: { role: 90, country: 80, workMode: 70, company: 60 }, review: { pay: 1, titles: 2 }, agentPrs: [] },
      checks: runChecks([row({ roleSlug: null })]),
    }
    const text = formatReport(snap, { checks: snap.checks.map((c) => ({ ...c, count: c.key === 'missing_role' ? 3 : c.count })) })
    expect(text).toContain('| missing_role | filters | medium | 1 | -2 | 1 |')
    expect(text).toContain('| odd_title | seo | medium | 0 | 0 | 1 |')
  })
})
