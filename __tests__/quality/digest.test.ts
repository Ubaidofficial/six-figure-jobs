/**
 * @jest-environment node
 */
// The weekly quality digest (lib/quality/digest.ts): when it is due, and what it says.
import { buildDigest, digestDue, weekOf } from '../../lib/quality/digest'
import { runChecks } from '../../lib/quality/checks'

jest.mock('../../lib/prisma', () => ({ prisma: {} }))

describe('when the digest is due', () => {
  it('the week is named by its Monday (UTC)', () => {
    expect(weekOf(new Date('2026-11-25T12:00:00Z'))).toBe('2026-11-23') // a Wednesday
    expect(weekOf(new Date('2026-11-23T00:00:00Z'))).toBe('2026-11-23')
    expect(weekOf(new Date('2026-11-29T23:59:00Z'))).toBe('2026-11-23') // Sunday
  })
  it('from Monday 07:00 UTC, once a week', () => {
    expect(digestDue(new Date('2026-11-23T06:59:00Z'), '2026-11-16')).toBe(false)
    expect(digestDue(new Date('2026-11-23T07:00:00Z'), '2026-11-16')).toBe(true)
    expect(digestDue(new Date('2026-11-25T10:00:00Z'), null)).toBe(true) // missed Monday: sent later that week
    expect(digestDue(new Date('2026-11-25T10:00:00Z'), '2026-11-23')).toBe(false)
  })
})

describe('what it says', () => {
  const now = new Date('2026-11-30T07:30:00Z')
  const metrics = (listed: number, role: number) => ({
    listedJobs: listed, pagesUp: listed + 100, fill: { role, country: 90, workMode: 80, company: 70 }, review: { pay: 3, titles: 9 }, agentPrs: [],
  })
  it('what moved, what waits for the owner, and what got fixed', () => {
    const latestChecks = runChecks([])
    latestChecks.find((c) => c.key === 'missing_role')!.count = 12
    const olderChecks = runChecks([])
    olderChecks.find((c) => c.key === 'missing_role')!.count = 40
    const { subject, text } = buildDigest(
      { capturedAt: now, metrics: metrics(1000, 95.5), checks: latestChecks },
      { capturedAt: new Date('2026-11-23T05:30:00Z'), metrics: metrics(950, 92), checks: olderChecks },
      [
        { key: 'missing_role', title: 'No role', severity: 'medium', count: 12, status: 'pr', prUrl: 'https://github.com/o/r/pull/9', fixedAt: null },
        { key: 'salary_inverted_range', title: 'Inverted pay', severity: 'high', count: 2, status: 'open', prUrl: null, fixedAt: null },
        { key: 'odd_title', title: 'Odd titles', severity: 'medium', count: 0, status: 'fixed', prUrl: null, fixedAt: new Date('2026-11-28T05:30:00Z') },
      ],
      'https://www.sixfigurejobs.net/ubaid93',
      now,
    )
    expect(subject).toBe('Quality this week: 2 open, 1 PR waiting')
    expect(text).toContain('Listed jobs 1000 (+50)')
    expect(text).toContain('role 95.5% (+3.5)')
    expect(text).toContain('  missing_role: 40 -> 12')
    expect(text).toContain('  No role: https://github.com/o/r/pull/9')
    expect(text.indexOf('[high] Inverted pay: 2')).toBeLessThan(text.indexOf('[medium] No role: 12 (PR open)'))
    expect(text).toContain('Fixed this week: Odd titles.')
    expect(text).toContain('Details: https://www.sixfigurejobs.net/ubaid93/quality')
  })
})
