import fixture from './fixtures/greenhouse-anduril.json'

import { fetchGreenhouseJob, parseGreenhouseUrl } from '@/lib/autoapply/greenhouse'
import { applyAnswers, buildPlan, missingFields, refreshProfileFields, type PlanInputs } from '@/lib/autoapply/plan'
import { ACTIVE_STATUSES, canMove, isFinal, planHash } from '@/lib/autoapply/state'

const ref = { board: 'andurilindustries', jobId: '5278136007' }
const inputs: PlanInputs = {
  email: 'ada@example.test',
  profile: { firstName: 'Ada', lastName: 'Lovelace', phone: '+1 555 0100', linkedin: 'https://linkedin.com/in/ada', website: null, github: null },
  resumeStamp: '1000',
  coverLetter: 'Dear team, I would like to apply.',
}
const okFetch = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

describe('parseGreenhouseUrl', () => {
  it.each([
    ['https://job-boards.greenhouse.io/gomotive/jobs/8910507002', { board: 'gomotive', jobId: '8910507002' }],
    ['https://boards.greenhouse.io/andurilindustries/jobs/5278136007?gh_jid=5278136007', { board: 'andurilindustries', jobId: '5278136007' }],
  ])('reads %s', (url, want) => expect(parseGreenhouseUrl(url)).toEqual(want))

  it.each([
    'https://jobs.lever.co/acme/123',
    'https://www.linkedin.com/jobs/view/123',
    'https://boards.greenhouse.io/acme', // a board, not a job
    'http://boards.greenhouse.io/acme/jobs/1', // not https
    'https://boards.greenhouse.io.evil.test/acme/jobs/1',
    'https://evil.test/?u=https://boards.greenhouse.io/acme/jobs/1',
    'not a url',
    null,
  ])('rejects %s', (url) => expect(parseGreenhouseUrl(url as string)).toBeNull())
})

describe('fetchGreenhouseJob', () => {
  it('reads the questions, the equal-opportunity block and the consent flag', async () => {
    const job = await fetchGreenhouseJob(ref, okFetch(fixture))
    expect(job!.title).toMatch(/Software Engineer/)
    expect(job!.questions.length).toBeGreaterThan(10)
    expect(job!.eeoc.length).toBeGreaterThan(0)
    expect(job!.needsConsent).toBe(false)
  })
  it('is null for a missing job or a malformed answer', async () => {
    expect(await fetchGreenhouseJob(ref, okFetch({}, 404))).toBeNull()
    expect(await fetchGreenhouseJob(ref, okFetch({ nope: 1 }))).toBeNull()
  })
})

describe('buildPlan on a real form with legal questions', () => {
  const job = { title: fixture.title, questions: fixture.questions as never, eeoc: [], needsConsent: false }
  const plan = buildPlan(job, ref, inputs)
  const byKey = Object.fromEntries(plan.fields.map((f) => [f.key, f]))

  it('fills the standard fields from the profile, the account, the résumé and the kit', () => {
    expect(byKey.first_name).toMatchObject({ source: 'profile', value: 'Ada' })
    expect(byKey.last_name).toMatchObject({ source: 'profile', value: 'Lovelace' })
    expect(byKey.phone).toMatchObject({ source: 'profile', value: '+1 555 0100' })
    expect(byKey.email).toMatchObject({ source: 'account', value: 'ada@example.test' })
    expect(byKey.resume).toMatchObject({ type: 'file', source: 'resume', value: '1000' })
    expect(byKey.cover_letter_text).toMatchObject({ source: 'kit', value: 'Dear team, I would like to apply.' })
    expect(byKey.resume_text).toBeUndefined()
  })

  it('adds the country and city from the profile for the newer form, empty when the profile has none', () => {
    expect(byKey.country).toMatchObject({ source: 'profile', required: false, value: null })
    expect(byKey['candidate-location']).toMatchObject({ source: 'profile', value: null })
    const withPlace = buildPlan(job, ref, { ...inputs, profile: { ...inputs.profile!, country: 'United States', city: 'Austin' } })
    expect(withPlace.fields.find((f) => f.key === 'country')!.value).toBe('United States')
    expect(withPlace.fields.find((f) => f.key === 'candidate-location')!.value).toBe('Austin')
  })

  it('fills only the link questions the profile can answer, matched by label', () => {
    const li = plan.fields.find((f) => /linkedin/i.test(f.label))!
    expect(li).toMatchObject({ source: 'profile', value: 'https://linkedin.com/in/ada' })
    const site = plan.fields.find((f) => /website/i.test(f.label))!
    expect(site.value).toBeNull() // no website in the profile: left empty, not invented
  })

  it('never answers a legal or eligibility question: they are the user\'s, empty, and block approval', () => {
    const legal = plan.fields.filter((f) => /clearance|export controls|work authorization|sponsorship|conflict of interest/i.test(f.label))
    expect(legal.length).toBeGreaterThanOrEqual(5)
    for (const f of legal) {
      expect(f.source).toBe('user')
      expect(f.value).toBeNull()
      expect(f.required).toBe(true)
    }
    const missing = missingFields(plan).map((f) => f.key)
    for (const f of legal) expect(missing).toContain(f.key)
  })

  it('every field that is not from the profile, account, résumé or kit is empty and the user\'s', () => {
    for (const f of plan.fields) {
      if (['profile', 'account', 'resume', 'kit'].includes(f.source)) continue
      expect(f.source).toBe('user')
      expect(f.value).toBeNull()
    }
  })

  it('has no missing required field without a profile only for what the user must supply', () => {
    const bare = buildPlan(job, ref, { ...inputs, profile: null, coverLetter: null })
    const keys = missingFields(bare).map((f) => f.key)
    expect(keys).toEqual(expect.arrayContaining(['first_name', 'last_name', 'phone']))
  })
})

describe('applyAnswers', () => {
  const job = { title: 't', questions: fixture.questions as never, eeoc: [], needsConsent: false }
  const base = buildPlan(job, ref, inputs)
  const auth = base.fields.find((f) => /U\.S\. WORK AUTHORIZATION/.test(f.label))!
  const other = base.fields.find((f) => /If other, please specify/.test(f.label))!

  it('takes an answer that is one of the employer\'s own options', () => {
    const opt = auth.options![0].value
    const { plan, errors } = applyAnswers(base, { [auth.key]: opt })
    expect(errors).toEqual({})
    expect(plan.fields.find((f) => f.key === auth.key)!.value).toBe(opt)
  })

  it('refuses an option the employer does not offer, a wrong type, and an over-long text', () => {
    expect(applyAnswers(base, { [auth.key]: 'maybe' }).errors[auth.key]).toBe('invalid')
    expect(applyAnswers(base, { [auth.key]: ['1'] }).errors[auth.key]).toBe('invalid')
    expect(applyAnswers(base, { [other.key]: 'x'.repeat(501) }).errors[other.key]).toBe('too_long')
  })

  it('cannot change the name, email, résumé or cover letter through answers (the profile and kit own them)', () => {
    const { plan } = applyAnswers(base, { first_name: 'Mallory', email: 'someone@else.test', resume: '9', cover_letter_text: 'injected' })
    expect(plan.fields.find((f) => f.key === 'first_name')!.value).toBe('Ada')
    const get = (k: string) => plan.fields.find((f) => f.key === k)!.value
    expect(get('email')).toBe('ada@example.test')
    expect(get('resume')).toBe('1000')
    expect(get('cover_letter_text')).toBe('Dear team, I would like to apply.')
  })

  it('an empty string clears an answer', () => {
    const filled = applyAnswers(base, { [other.key]: 'Referral' }).plan
    expect(filled.fields.find((f) => f.key === other.key)!.value).toBe('Referral')
    const cleared = applyAnswers(filled, { [other.key]: '   ' }).plan
    expect(cleared.fields.find((f) => f.key === other.key)!.value).toBeNull()
  })
})

describe('planHash and the state machine', () => {
  const job = { title: 't', questions: fixture.questions as never, eeoc: [], needsConsent: false }
  const base = buildPlan(job, ref, inputs)

  it('is stable for the same answers in any order, and changes when anything that is submitted changes', () => {
    const h = planHash(base)
    expect(planHash({ ...base, fields: [...base.fields].reverse() })).toBe(h)
    const other = base.fields.find((f) => /If other, please specify/.test(f.label))!
    expect(planHash(applyAnswers(base, { [other.key]: 'Referral' }).plan)).not.toBe(h)
    expect(planHash({ ...base, resumeStamp: '2000' })).not.toBe(h)
    expect(planHash({ ...base, consentGiven: true })).not.toBe(h)
  })

  it('only moves forward along the allowed path', () => {
    expect(canMove('draft', 'approved')).toBe(true)
    expect(canMove('approved', 'submitting')).toBe(true)
    expect(canMove('submitting', 'submitted')).toBe(true)
    expect(canMove('draft', 'submitting')).toBe(false) // cannot skip approval
    expect(canMove('submitted', 'draft')).toBe(false)
    expect(canMove('needs_user', 'submitting')).toBe(false) // a stopped application is never silently retried
  })

  it('treats submitted, stopped and cancelled as final; only live ones block a second application', () => {
    for (const s of ['submitted', 'needs_user', 'failed', 'cancelled'] as const) expect(isFinal(s)).toBe(true)
    expect(ACTIVE_STATUSES).toEqual(['draft', 'approved', 'submitting', 'submitted'])
  })
})

describe('refreshProfileFields', () => {
  const job = { title: 't', questions: fixture.questions as never, eeoc: [], needsConsent: false }

  it('re-reads name, phone and links from a changed profile and leaves the user\'s answers alone', () => {
    const base = buildPlan(job, ref, { ...inputs, profile: null })
    const other = base.fields.find((f) => /If other, please specify/.test(f.label))!
    const answered = applyAnswers(base, { [other.key]: 'Referral' }).plan
    const next = refreshProfileFields(answered, inputs)
    const get = (k: string) => next.fields.find((f) => f.key === k)!.value
    expect(get('first_name')).toBe('Ada')
    expect(get('phone')).toBe('+1 555 0100')
    expect(next.fields.find((f) => /linkedin/i.test(f.label))!.value).toBe('https://linkedin.com/in/ada')
    expect(get(other.key)).toBe('Referral')
  })
})
