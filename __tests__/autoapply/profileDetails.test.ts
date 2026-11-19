jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { buildPlan, detailKind, refreshProfileFields, type PlanInputs } from '@/lib/autoapply/plan'
import { cleanProfile } from '@/lib/autoapply/service'

const q = (label: string, name: string, type = 'input_text', required = false) => ({ label, required, fields: [{ name, type }] })
const job = {
  title: 'Engineer', eeoc: [], needsConsent: false,
  questions: [
    q('Current Company*', 'question_1', 'input_text', true),
    q('Notice period?', 'question_2', 'textarea'),
    q('Have you worked at a competitor company?', 'question_3'),
    q('Current title', 'question_4', 'input_text', true),
  ],
}
const inputs = (extra: Record<string, string | null> = {}): PlanInputs => ({
  email: 'a@b.test', resumeStamp: '1', coverLetter: null,
  profile: { firstName: 'Ada', lastName: 'L', phone: '+44 20 7946 0958', currentCompany: 'Analytical Engines Ltd', noticePeriod: '4 weeks', currentTitle: null, ...extra },
})

describe('common questions answered from the profile', () => {
  it('matches whole wordings only, never a question that merely contains the words', () => {
    expect(detailKind('Current Company*')).toBe('currentCompany')
    expect(detailKind('ZIP / Postal code')).toBe('postalCode')
    expect(detailKind('ZIP code of your previous employer')).toBe(null)
    expect(detailKind('Zip/Postal code')).toBe('postalCode')
    expect(detailKind('Have you worked at a competitor company?')).toBe(null)
    expect(detailKind('What are your salary expectations?')).toBe('salaryExpectation')
  })

  it('fills from the profile when the user saved an answer, and leaves it to the user otherwise', () => {
    const plan = buildPlan(job as never, { board: 'b', jobId: '1' }, inputs())
    const by = Object.fromEntries(plan.fields.map((f) => [f.key, f]))
    expect(by.question_1).toMatchObject({ source: 'profile', value: 'Analytical Engines Ltd', required: true })
    expect(by.question_2).toMatchObject({ source: 'profile', value: '4 weeks' })
    expect(by.question_3).toMatchObject({ source: 'user', value: null })
    expect(by.question_4).toMatchObject({ source: 'user', value: null }) // no current title saved
  })

  it('follows profile edits, and hands a cleared detail back to the user', () => {
    const plan = buildPlan(job as never, { board: 'b', jobId: '1' }, inputs())
    const next = refreshProfileFields(plan, inputs({ currentCompany: null, noticePeriod: '2 weeks' }))
    const by = Object.fromEntries(next.fields.map((f) => [f.key, f]))
    expect(by.question_1).toMatchObject({ source: 'user', value: null })
    expect(by.question_2).toMatchObject({ source: 'profile', value: '2 weeks' })
  })

  it('keeps details as plain text: no links or markup, sensible lengths', () => {
    const base = { firstName: 'Ada', lastName: 'L', phone: '+44 20 7946 0958' }
    expect(cleanProfile({ ...base, currentCompany: '  Acme  ', languages: 'English, French' })).toMatchObject({ ok: true, profile: { currentCompany: 'Acme', languages: 'English, French', state: null } })
    expect(cleanProfile({ ...base, currentCompany: 'visit https://spam.test' })).toEqual({ ok: false, fields: ['currentCompany'] })
    expect(cleanProfile({ ...base, postalCode: 'x'.repeat(30) })).toEqual({ ok: false, fields: ['postalCode'] })
    expect(cleanProfile({ ...base, phone: '415 555 0100' })).toEqual({ ok: false, fields: ['phone'] })
  })
})
