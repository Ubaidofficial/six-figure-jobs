/**
 * @jest-environment node
 */
jest.mock('../../lib/prisma', () => ({ prisma: {} }))

import { evaluateHealth, type HealthFacts } from '../../lib/admin/health'
import { buildAlertEmail, healthAlertsEveryMs, parseAlertState, planAlerts, runHealthAlerts } from '../../lib/admin/healthAlerts'

const NOW = new Date('2026-11-24T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000)

const healthy: HealthFacts = {
  liveJobs: 62_000,
  newestJob: { createdAt: hoursAgo(0.1), source: 'board:freehire' },
  closingsReadAt: hoursAgo(3),
  indexing: { pending: 3, sent: 900 },
  indexingFailed24h: 0,
  indexingFailed7d: 0,
  errorBurst: null,
  wave: 1,
  phase: 1,
}
const tones = (f: Partial<HealthFacts>) =>
  Object.fromEntries(evaluateHealth({ ...healthy, ...f }, NOW.getTime()).map((c) => [c.key, c.tone]))

describe('health rules', () => {
  it('is all ok on a normal day', () => {
    expect(tones({})).toEqual({ live: 'ok', arrivals: 'ok', closings: 'ok', indexing: 'ok', errors: 'ok', search: 'muted' })
  })
  it('flags the empty-database outage (pages answer 200 with almost no jobs)', () => {
    expect(tones({ liveJobs: 0, newestJob: null }).live).toBe('bad')
    expect(tones({ liveJobs: 0, newestJob: null }).arrivals).toBe('bad')
  })
  it('warns, then fails, as new jobs stop arriving', () => {
    expect(tones({ newestJob: { createdAt: hoursAgo(5), source: 'x' } }).arrivals).toBe('warn')
    expect(tones({ newestJob: { createdAt: hoursAgo(13), source: 'x' } }).arrivals).toBe('bad')
  })
  it('fails when the closings feed has not been read for a day', () => {
    expect(tones({ closingsReadAt: hoursAgo(10) }).closings).toBe('warn')
    expect(tones({ closingsReadAt: hoursAgo(25) }).closings).toBe('bad')
  })
  it('fails on 20 Google notice failures in a day, warns on any in a week', () => {
    expect(tones({ indexingFailed7d: 1 }).indexing).toBe('warn')
    expect(tones({ indexingFailed24h: 20, indexingFailed7d: 20 }).indexing).toBe('bad')
  })
  it('fails when one browser error reaches 100 reports in an hour', () => {
    expect(tones({ errorBurst: { message: 'TypeError: x', count: 25 } }).errors).toBe('warn')
    expect(tones({ errorBurst: { message: 'TypeError: x', count: 100 } }).errors).toBe('bad')
  })
})

describe('alert emails', () => {
  const checksWith = (f: Partial<HealthFacts>) => evaluateHealth({ ...healthy, ...f }, NOW.getTime())
  const empty = parseAlertState(null)

  it('emails when a check turns bad, then stays quiet until a day has passed', () => {
    const bad = checksWith({ newestJob: { createdAt: hoursAgo(13), source: 'x' } })
    const first = planAlerts(bad, empty, NOW, true)
    expect(first.turnedBad.map((c) => c.key)).toEqual(['arrivals'])
    expect(buildAlertEmail(first, 'u')?.subject).toBe('Six Figure Jobs alert: New jobs arriving')

    const later = planAlerts(bad, first.next, new Date(NOW.getTime() + 30 * 60_000), true)
    expect(later.turnedBad).toEqual([])
    expect(later.remind).toEqual([])
    expect(buildAlertEmail(later, 'u')).toBeNull()

    const nextDay = planAlerts(bad, first.next, new Date(NOW.getTime() + 24 * 3_600_000), true)
    expect(nextDay.remind.map((c) => c.key)).toEqual(['arrivals'])
    expect(buildAlertEmail(nextDay, 'u')?.text).toContain('STILL    New jobs arriving')
  })

  it('emails once when the check recovers', () => {
    const first = planAlerts(checksWith({ liveJobs: 10 }), empty, NOW, true)
    const fixed = planAlerts(checksWith({}), first.next, new Date(NOW.getTime() + 3_600_000), true)
    expect(fixed.recovered.map((r) => r.key)).toEqual(['live'])
    expect(buildAlertEmail(fixed, 'u')?.subject).toBe('Six Figure Jobs fixed: Live jobs')
    expect(fixed.next.open).toEqual({})
  })

  it('reports an open problem as soon as email is set up, and sends nothing before', async () => {
    const sent: string[] = []
    let state: string | null = null
    const run = (env: Record<string, string>, at: Date) =>
      runHealthAlerts({
        now: at,
        env,
        send: async (m) => void sent.push(m.subject),
        loadChecks: async () => checksWith({ liveJobs: 0 }),
        loadState: async () => state,
        saveState: async (v) => void (state = v),
      })
    await run({}, NOW)
    expect(sent).toEqual([])
    await run({ ALERTS_OWNER_EMAIL: 'owner@example.test', RESEND_API_KEY: 'k', EMAIL_FROM: 'a@example.test' }, new Date(NOW.getTime() + 60_000))
    expect(sent).toEqual(['Six Figure Jobs alert: Live jobs'])
  })

  it('tries again on the next run when the email fails', async () => {
    let state: string | null = null
    const env = { OPS_ALERT_EMAIL: 'ops@example.test', RESEND_API_KEY: 'k', EMAIL_FROM: 'a@example.test' }
    const base = { env, loadChecks: async () => checksWith({ liveJobs: 0 }), loadState: async () => state, saveState: async (v: string) => void (state = v) }
    const failed = await runHealthAlerts({ ...base, now: NOW, send: async () => Promise.reject(new Error('quota')) })
    expect(failed.emailed).toBe(false)
    const sent: string[] = []
    const retry = await runHealthAlerts({ ...base, now: new Date(NOW.getTime() + 30 * 60_000), send: async (m) => void sent.push(m.text) })
    expect(retry.emailed).toBe(true)
    expect(sent[0]).toContain('STILL    Live jobs')
  })

  it('runs every 30 minutes by default; 0 turns it off; never more often than every 5', () => {
    expect(healthAlertsEveryMs({})).toBe(30 * 60_000)
    expect(healthAlertsEveryMs({ HEALTH_ALERTS_EVERY_MIN: '0' })).toBe(0)
    expect(healthAlertsEveryMs({ HEALTH_ALERTS_EVERY_MIN: '1' })).toBe(5 * 60_000)
  })
})
