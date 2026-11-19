import { isDemographic, matchSaved, prefillFromSaved, questionKey, toSaved, type SavedAnswerRow } from '@/lib/autoapply/answers'
import { applyAnswers, confirmSaved, missingFields, type Plan, type PlanField } from '@/lib/autoapply/plan'

const yesNo = [{ label: 'Yes', value: '11' }, { label: 'No', value: '12' }]
const f = (label: string, extra: Partial<PlanField> = {}): PlanField => ({ key: 'q1', label, type: 'single', required: true, source: 'user', value: null, options: yesNo, ...extra })
const saved = (question: string, answer: unknown, type = 'single'): SavedAnswerRow => ({ question, questionKey: questionKey(question), type, answer })

describe('saved answers: matching', () => {
  it('pre-fills only the same question, by the option wording this employer uses', () => {
    const m = matchSaved(f('Will you now or in the future require visa sponsorship?'), [saved('Will you now, or in the future, require visa sponsorship', ['No'])])
    expect(m).toEqual({ exact: '12' })
    // Same question, but this employer has no option worded "No": nothing is filled.
    expect(matchSaved(f('Will you now or in the future require visa sponsorship?', { options: [{ label: 'Yes', value: '1' }, { label: 'Not now', value: '2' }] }), [saved('Will you now or in the future require visa sponsorship?', ['No'])])).toBeNull()
  })

  it('only suggests for similar wording, never across a "not", and never when two answers tie', () => {
    const q = f('Are you legally authorized to work in the United States?')
    expect(matchSaved(q, [saved('Are you authorized to work in the United States?', ['Yes'])])).toEqual({
      suggest: { question: 'Are you authorized to work in the United States?', text: 'Yes', value: '11' },
    })
    expect(matchSaved(q, [saved('Are you not authorized to work in the United States?', ['No'])])).toBeNull()
    expect(matchSaved(q, [saved('Are you authorized to work in the United States?', ['Yes']), saved('Are you authorized to work in United States?', ['No'])])).toBeNull()
    expect(matchSaved(q, [saved('Do you have a security clearance?', ['Yes'])])).toBeNull()
  })

  it('never saves or matches demographic questions', () => {
    expect(isDemographic('What is your gender identity?')).toBe(true)
    expect(isDemographic('Are you a protected veteran?')).toBe(true)
    expect(toSaved(f('What is your gender identity?', { value: '11' }))).toBeNull()
    expect(matchSaved(f('What is your race?'), [saved('What is your race?', ['Yes'])])).toBeNull()
  })

  it('keeps choices as wording and text as text; a pre-fill nobody ticked is not kept', () => {
    expect(toSaved(f('Sponsorship?', { value: '12' }))).toMatchObject({ type: 'single', answer: ['No'], questionKey: 'sponsorship' })
    expect(toSaved(f('Why us?', { type: 'textarea', options: undefined, value: 'Because.' }))).toMatchObject({ answer: 'Because.' })
    expect(toSaved(f('Sponsorship?', { value: '12', saved: 'exact', confirmed: false }))).toBeNull()
    expect(toSaved(f('Sponsorship?', { value: '12', source: 'profile' }))).toBeNull()
  })
})

describe('saved answers: approval needs a tick', () => {
  const plan = (): Plan => ({ board: 'b', jobId: '1', title: 't', needsConsent: false, consentGiven: false, resumeStamp: '1', fields: [f('Sponsorship?'), f('Optional question', { key: 'q2', required: false })] })
  const rows = [saved('Sponsorship?', ['No']), saved('Optional question', ['Yes'])]

  it('blocks approval until each pre-filled answer is ticked, required or not', () => {
    const p = prefillFromSaved(plan(), rows)
    expect(p.fields.map((x) => [x.value, x.saved, x.confirmed])).toEqual([['12', 'exact', false], ['11', 'exact', false]])
    expect(missingFields(p).map((x) => x.key)).toEqual(['q1', 'q2'])
    expect(missingFields(confirmSaved(p, ['q1'])).map((x) => x.key)).toEqual(['q2'])
    expect(missingFields(confirmSaved(p, ['q1', 'q2']))).toEqual([])
  })

  it('an answer the user changes themselves is theirs and needs no tick', () => {
    const p = applyAnswers(prefillFromSaved(plan(), rows), { q2: '12' }).plan
    expect(p.fields[1]).toMatchObject({ value: '12' })
    expect(p.fields[1].saved).toBeUndefined()
    expect(missingFields(p).map((x) => x.key)).toEqual(['q1'])
  })
})

describe('an optional dropdown left on "Choose…"', () => {
  it('is saved as no answer, not refused', () => {
    const plan: Plan = { board: 'b', jobId: '1', title: 't', needsConsent: false, consentGiven: false, resumeStamp: '1', fields: [f('Pronouns', { required: false })] }
    const r = applyAnswers(plan, { q1: '' })
    expect(r.errors).toEqual({})
    expect(r.plan.fields[0].value).toBeNull()
    expect(applyAnswers(plan, { q1: 'not-an-option' }).errors).toEqual({ q1: 'invalid' })
  })
})
