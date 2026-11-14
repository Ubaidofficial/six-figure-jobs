import { findRemoteEvidence } from '../../lib/jobs/remoteEvidence'
import { verifyQuote, plainPostingText } from '../../lib/jobs/verifiedQuote'

const mode = (html: string) => findRemoteEvidence(html)?.mode ?? null

describe('findRemoteEvidence', () => {
  it('reads a fully remote role and returns the sentence', () => {
    const html = '<p>About us.</p><p>This role is fully remote and open to candidates across Europe.</p>'
    expect(findRemoteEvidence(html)).toEqual({
      mode: 'remote',
      quote: 'This role is fully remote and open to candidates across Europe.',
    })
  })

  it('reads remote-first, 100% remote and remote role wordings', () => {
    expect(mode('<p>We are a remote-first company building payments infrastructure.</p>')).toBe('remote')
    expect(mode('<p>The position is 100% remote within the United States.</p>')).toBe('remote')
    expect(mode('<li>Remote role, flexible hours across time zones</li>')).toBe('remote')
  })

  it('reads hybrid and on-site roles', () => {
    expect(mode('<p>This is a hybrid role with three days a week in the Berlin office.</p>')).toBe('hybrid')
    expect(mode('<p>The position is on-site in Austin, TX.</p>')).toBe('onsite')
    expect(mode('<p>Our Austin office has free lunch and an on-site gym.</p>')).toBeNull() // only an explicit statement counts
    expect(mode('<p>This role is on-site at our Austin headquarters.</p>')).toBe('onsite')
    expect(mode('<p>You must be in the office five days a week.</p>')).toBe('onsite')
    expect(mode('<p>Employees are required to work in the office.</p>')).toBe('onsite')
  })

  it('never reads a negation as remote', () => {
    expect(mode('<p>This is not a remote role.</p>')).toBeNull()
    expect(mode('<p>Remote work is not available for this position.</p>')).toBeNull()
    expect(mode('<p>No remote work. This role is on-site at our HQ.</p>')).toBe('onsite')
  })

  it('says nothing when the posting contradicts itself', () => {
    expect(mode('<p>This role is fully remote.</p><p>You will be hybrid, three days a week in the office.</p>')).toBeNull()
    expect(mode('<p>Our team is remote-first.</p><p>No remote candidates will be considered for this seat.</p>')).toBeNull()
  })

  it('says nothing about perks, technology and passing mentions', () => {
    expect(mode('<p>We offer a remote work stipend and a home office budget.</p>')).toBeNull()
    expect(mode('<p>Experience with hybrid cloud and remote desktop tools.</p>')).toBeNull()
    expect(mode('<p>You will manage remote teams across the globe.</p>')).toBeNull()
    expect(mode('<p>Build great software.</p>')).toBeNull()
    expect(mode(null)).toBeNull()
  })

  it('always returns a quote that is in the posting', () => {
    const html = '<ul><li>Competitive pay</li><li>We are &quot;remote-first&quot; &amp; proud of it.</li></ul>'
    const found = findRemoteEvidence(html)
    expect(found?.mode).toBe('remote')
    expect(verifyQuote(found!.quote, plainPostingText(html))).toBe(true)
  })
})
