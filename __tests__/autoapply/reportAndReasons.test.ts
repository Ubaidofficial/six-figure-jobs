import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

import { approvedAnswers, type Plan } from '@/lib/autoapply/plan'
import { REASONS, reasonText } from '@/lib/autoapply/reasons'
import { LEFT_EMPTY, summarizeRuns } from '@/lib/autoapply/runReport'

describe('stop reasons', () => {
  it('every reason code the worker or service can write has plain words and a next step', () => {
    const dir = join(process.cwd(), 'lib/autoapply')
    const src = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
    const codes = new Set([...src.matchAll(/(?:reason: '|stop\(')([a-z_]+)'/g)].map((m) => m[1]))
    expect(codes.size).toBeGreaterThan(8)
    for (const code of codes) {
      expect(REASONS[code]).toBeDefined()
      expect(REASONS[code].what.length).toBeGreaterThan(20)
      expect(REASONS[code].next.length).toBeGreaterThan(20)
    }
  })

  it('an unknown code still gets a sentence, never the bare code', () => {
    expect(reasonText('timeout').what).toMatch(/Nothing was charged/)
    expect(reasonText(null).next).toBeTruthy()
  })
})

describe('approved answers to copy', () => {
  const plan = {
    board: 'acme', jobId: '1', title: 'x', needsConsent: false, consentGiven: false, resumeStamp: '1',
    fields: [
      { key: 'first_name', label: 'First Name', type: 'text', required: true, source: 'profile', value: 'Ada' },
      { key: 'resume', label: 'Resume/CV', type: 'file', required: true, source: 'resume', value: 'resume' },
      { key: 'q1', label: 'Authorized to work in the US?', type: 'single', required: true, source: 'user', value: '11', options: [{ label: 'Yes', value: '11' }, { label: 'No', value: '12' }] },
      { key: 'q2', label: 'Languages', type: 'multi', required: false, source: 'user', value: ['a', 'b'], options: [{ label: 'English', value: 'a' }, { label: 'Spanish', value: 'b' }] },
      { key: 'q3', label: 'Empty', type: 'text', required: false, source: 'user', value: null },
    ],
  } as unknown as Plan

  it('shows option wording, skips files and empty answers', () => {
    expect(approvedAnswers(plan)).toEqual([
      { key: 'first_name', label: 'First Name', text: 'Ada' },
      { key: 'q1', label: 'Authorized to work in the US?', text: 'Yes' },
      { key: 'q2', label: 'Languages', text: 'English, Spanish' },
    ])
  })
})

describe('owner run report', () => {
  it('groups runs by board, counts whole forms and stop reasons, and ranks empty questions by label', () => {
    const r = summarizeRuns([
      { board: 'acme', mode: 'dry_run', outcome: 'dry_run', reason: null, unfilled: [] },
      { board: 'acme', mode: 'dry_run', outcome: 'dry_run', reason: null, unfilled: [{ key: 'question_1', label: 'Visa sponsorship?' }] },
      { board: 'acme', mode: 'live', outcome: 'needs_user', reason: 'captcha', unfilled: null },
      { board: 'beta', mode: 'live', outcome: 'submitted', reason: null, unfilled: null },
      { board: 'beta', mode: 'dry_run', outcome: 'dry_run', reason: null, unfilled: [{ key: 'question_77', label: 'Visa sponsorship?' }, { key: 'phone', label: '' }] },
      { board: 'beta', mode: 'dry_run', outcome: 'dry_run', reason: null, unfilled: 'garbage' },
    ])
    expect(r.total).toBe(6)
    expect(r.boards).toEqual([
      { board: 'acme', runs: 3, clean: 1, submitted: 0, stops: { [LEFT_EMPTY]: 1, captcha: 1 } },
      { board: 'beta', runs: 3, clean: 2, submitted: 1, stops: { [LEFT_EMPTY]: 1 } },
    ])
    expect(r.fields[0]).toMatchObject({ label: 'Visa sponsorship?', count: 2, boards: 2 })
    expect(r.fields[1]).toMatchObject({ key: 'phone', count: 1 })
    expect(r.clean).toBe(3)
  })
})

describe('phone with country code', () => {
  const { isIntlPhone, missingFields } = jest.requireActual('@/lib/autoapply/plan') as typeof import('@/lib/autoapply/plan')
  it('accepts + country code and number, refuses a number a form could read as another country', () => {
    expect(isIntlPhone('+44 20 7946 0958')).toBe(true)
    expect(isIntlPhone('+1 (415) 555-0100')).toBe(true)
    expect(isIntlPhone('415 555 0100')).toBe(false)
    expect(isIntlPhone('+12')).toBe(false)
    expect(isIntlPhone('+1 415 555 0100 ext 2')).toBe(false)
    expect(isIntlPhone(null)).toBe(false)
  })
  it('a required phone without a country code blocks approval', () => {
    const plan = { fields: [{ key: 'phone', label: 'Phone', type: 'text', required: true, source: 'profile', value: '555 0100' }] } as never
    expect(missingFields(plan).map((f: { key: string }) => f.key)).toEqual(['phone'])
  })
})
