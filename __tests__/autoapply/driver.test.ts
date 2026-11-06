// Drives the real browser driver against a local replica of the employer's form (fixtures/greenhouseForm.ts). Needs a
// Chromium, so it runs when AUTOAPPLY_BROWSER_TESTS=1 (and AUTOAPPLY_CHROME_PATH points at one); CI skips it.
import { startFixtureServer } from './fixtures/greenhouseForm'

import { createBrowserDriver } from '@/lib/autoapply/browserDriver'
import type { Plan, PlanField } from '@/lib/autoapply/plan'

const run = process.env.AUTOAPPLY_BROWSER_TESTS === '1' ? describe : describe.skip

const field = (key: string, type: PlanField['type'], value: PlanField['value'], extra: Partial<PlanField> = {}): PlanField => ({
  key, label: key, type, required: false, source: 'user', value, ...extra,
})
const yesNo = [{ label: 'Yes', value: '1' }, { label: 'No', value: '0' }]
const growth = [{ label: 'Career Growth', value: '11' }, { label: 'Culture', value: '12' }]

const planWith = (over: Record<string, PlanField['value']> = {}): Plan => ({
  board: 'acme', jobId: '1', title: 'Software Engineer', needsConsent: false, consentGiven: false, resumeStamp: '1000',
  fields: [
    field('first_name', 'text', 'Ada', { required: true, source: 'profile' }),
    field('last_name', 'text', 'Lovelace', { required: true, source: 'profile' }),
    field('email', 'text', 'ada@example.test', { required: true, source: 'account' }),
    field('phone', 'text', '+1 555 0100', { required: true, source: 'profile' }),
    field('country', 'text', 'United States', { source: 'profile' }),
    field('candidate-location', 'text', 'Austin', { source: 'profile' }),
    field('resume', 'file', '1000', { required: true, source: 'resume' }),
    field('cover_letter_text', 'textarea', 'Dear team,\nI would like to apply.', { source: 'kit' }),
    field('question_1', 'single', '1', { required: true, options: yesNo }),
    field('question_2', 'multi', ['11'], { required: true, options: growth }),
    field('question_3', 'textarea', 'Because of the mission.', { required: true }),
    field('question_4', 'text', 'https://linkedin.com/in/ada', { source: 'profile' }),
  ].map((f) => (f.key in over ? { ...f, value: over[f.key] } : f)),
})

run('browser driver against the employer form replica', () => {
  let server: Awaited<ReturnType<typeof startFixtureServer>>
  let driver: ReturnType<typeof createBrowserDriver>

  beforeAll(async () => {
    server = await startFixtureServer()
    const puppeteer = (await import('puppeteer')).default
    driver = createBrowserDriver({
      launch: () => puppeteer.launch({ executablePath: process.env.AUTOAPPLY_CHROME_PATH, headless: true, args: ['--no-sandbox'] }),
      formTimeoutMs: 5000,
      confirmTimeoutMs: 4000,
    })
  }, 60_000)
  afterAll(() => server.close())
  beforeEach(() => { server.received.length = 0 })

  const go = (plan: Plan, live: boolean, mode = 'confirm') =>
    driver({ applyUrl: `${server.url}/?mode=${mode}`, plan, resumeText: 'Ada Lovelace\nEngineer\n<script>alert(1)</script>', live })

  it('live: fills every approved answer, attaches the résumé as a PDF, submits, and reports the employer\'s confirmation', async () => {
    const out = await go(planWith(), true)
    expect(out).toMatchObject({ kind: 'submitted' })
    expect((out as { evidence: string }).evidence).toMatch(/Thank you for applying/)
    expect(server.received).toHaveLength(1)
    const got = server.received[0]
    expect(got.fields).toEqual({
      first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.test', phone: '+1 555 0100', country: 'United States', city: 'Austin',
      authorized: 'Yes', why: 'Because of the mission.', linkedin: 'https://linkedin.com/in/ada',
      cover_letter: 'Dear team,\nI would like to apply.', matters: ['question_2[]_11'],
    })
    expect(got.resumeFile).toBe('Resume.pdf')
    expect(got.resumeBytes).toBeGreaterThan(500)
  }, 60_000)

  it('dry run: fills the form and reports what it filled, but sends nothing', async () => {
    const out = await go(planWith(), false)
    expect(out).toMatchObject({ kind: 'dry_run', unfilled: [] })
    expect((out as { filled: string[] }).filled).toEqual(expect.arrayContaining(['first_name', 'question_1', 'question_2', 'resume', 'cover_letter_text']))
    expect(server.received).toHaveLength(0)
  }, 60_000)

  it('never submits while a required field is empty: it reports the field and hands back', async () => {
    const dry = await go(planWith({ question_3: null }), false)
    expect(dry).toMatchObject({ kind: 'dry_run' })
    expect((dry as { unfilled: string[] }).unfilled).toContain('question_3')
    expect(await go(planWith({ question_3: null }), true)).toEqual({ kind: 'needs_user', reason: 'unexpected_field' })
    expect(server.received).toHaveLength(0)
  }, 60_000)

  it('does not guess when the approved option is not one the form offers', async () => {
    const plan = planWith()
    plan.fields = plan.fields.map((f) => (f.key === 'question_1' ? { ...f, value: '9', options: [{ label: 'Perhaps', value: '9' }] } : f))
    expect(await go(plan, true)).toEqual({ kind: 'needs_user', reason: 'unexpected_field' })
    expect(server.received).toHaveLength(0)
  }, 60_000)

  it.each([
    ['captcha', 'captcha'],
    ['code', 'security_code'],
    ['invalid', 'validation'],
    ['silent', 'unconfirmed'],
  ] as const)('after submit, a "%s" page hands back as %s (never as a success)', async (mode, reason) => {
    expect(await go(planWith(), true, mode)).toEqual({ kind: 'needs_user', reason })
  }, 60_000)

  it('a page without the form is a failure, not a hand-off', async () => {
    const out = await driver({ applyUrl: `${server.url}/missing`, plan: planWith(), resumeText: 'x', live: true })
    expect(out).toEqual({ kind: 'failed', reason: 'form_not_found' })
  }, 60_000)
})
