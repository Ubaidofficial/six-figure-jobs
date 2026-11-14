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
    // The company's culture is not the role: only statements about this role count.
    expect(mode('<p>We are a remote-first company building payments infrastructure.</p>')).toBeNull()
    expect(mode('<p>Our fully remote, global team keeps the platform secure.</p>')).toBeNull()
    expect(mode('<p>Remote first culture (for most roles).</p>')).toBeNull()
    expect(mode('<p>Location: Fully remote (US)</p>')).toBe('remote')
    expect(mode('<p>You will work remotely from anywhere in the EU.</p>')).toBe('remote')
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

  it('reads five days a week in the office as on-site, not hybrid', () => {
    expect(mode('<p>This is an in-office role, 5 days per week at our San Francisco office.</p>')).toBe('onsite')
    expect(mode('<p>You can work on-site in San Francisco 5 days a week.</p>')).toBe('onsite')
    expect(mode('<p>The team is in the office 3 days a week.</p>')).toBe('hybrid')
  })

  it('does not read "hybrid" or "remote" used for technology as how the role is worked', () => {
    expect(mode('<p>Networks are moving toward a hybrid model in which agents handle scoped tasks.</p>')).toBeNull()
    expect(mode('<p>Manage our hybrid environment of cloud and data center.</p>')).toBeNull()
  })

  it('says nothing about perks, technology and passing mentions', () => {
    expect(mode('<p>We offer a remote work stipend and a home office budget.</p>')).toBeNull()
    expect(mode('<p>Experience with hybrid cloud and remote desktop tools.</p>')).toBeNull()
    expect(mode('<p>You will manage remote teams across the globe.</p>')).toBeNull()
    expect(mode('<p>Build great software.</p>')).toBeNull()
    expect(mode(null)).toBeNull()
  })

  it('always returns a quote that is in the posting', () => {
    const html = '<ul><li>Competitive pay</li><li>This role is fully remote &amp; open to EU residents.</li></ul>'
    const found = findRemoteEvidence(html)
    expect(found?.mode).toBe('remote')
    expect(verifyQuote(found!.quote, plainPostingText(html))).toBe(true)
  })
})
