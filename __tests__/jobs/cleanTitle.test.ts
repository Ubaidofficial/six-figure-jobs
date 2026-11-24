import { cleanJobTitle } from '../../lib/jobs/cleanTitle'

describe('cleanJobTitle', () => {
  it.each([
    // Live, 2026-11-24 (freehire, LinkedIn postings by Jobot).
    ['Attorney---Commercial Real Estate---Charlotte---$120k-$180k', 'Charlotte, NC', 'Attorney - Commercial Real Estate'],
    ['Sr. Attorney---Tax Attorney---Charlotte---$180k-$225k', 'Charlotte, NC', 'Sr. Attorney - Tax Attorney'],
    ['Staff Engineer - Payments (150K-200K)', null, 'Staff Engineer - Payments'],
    // Live, 2026-11-24 dry run: the pay went but "to" stayed.
    ['Audit Senior (Non Profit OR For Profit) - Public - to $120k', null, 'Audit Senior (Non Profit OR For Profit) - Public'],
    ['Engineering Manager - from $150k', null, 'Engineering Manager'],
    ['AI Engineer South London Hybrid £100-150k', null, 'AI Engineer South London Hybrid'],
    ['Data Engineer - Berlin - €90,000', null, 'Data Engineer - Berlin'],
    ['Family Nurse Practitioner – Outpatient Primary Care | Connecticut | $120K–$145K+ Base', null, 'Family Nurse Practitioner – Outpatient Primary Care | Connecticut'],
    ['Firmware / HW Engineering Manager (Austin): $180-200K', null, 'Firmware / HW Engineering Manager (Austin)'],
    ['Financial Controller - 100k-140k', null, 'Financial Controller'],
    ['Attorney (Insurance Coverage) Los Angeles 160K', null, 'Attorney (Insurance Coverage) Los Angeles'],
    ['Senior Product Manager [$180k + equity]', null, 'Senior Product Manager'],
    ['Nurse Practitioner | $140,000 - $160,000', null, 'Nurse Practitioner'],
    ['Data Engineer - $165K/yr', null, 'Data Engineer'],
    ['Controller---Manufacturing---Up to $150k', 'Dallas, TX', 'Controller - Manufacturing'],
  ])('%s -> %s', (title, location, expected) => {
    expect(cleanJobTitle(title, { location })).toBe(expected)
  })

  it.each([
    'Senior Software Engineer',
    'Senior Engineer, 401k plan administration',
    'Director, 100K Club Partnerships',
    'Technical Lead, AI-Native Software Engineering (hybrid) - 2025652',
    'C++ Engineer (3D graphics)',
    'Head of $1B Fund Operations',
    'Manager (Team of 12k users)',
    'VP, Sales (EMEA)',
  ])('leaves "%s" alone', (title) => {
    expect(cleanJobTitle(title)).toBe(title)
  })

  it('does not rewrite a title only to change its spacing', () => {
    expect(cleanJobTitle('Strategy Manager ')).toBe('Strategy Manager ')
    expect(cleanJobTitle('Physical Therapist  - Dallas')).toBe('Physical Therapist  - Dallas')
  })

  it('cleans pay at the end of a long pipe title (live)', () => {
    expect(cleanJobTitle('Lead Platform Engineer | DevOps and On-Prem | First Platform Hire | 1-2% Equity | $220K-$300K')).toBe(
      'Lead Platform Engineer | DevOps and On-Prem | First Platform Hire | 1-2% Equity',
    )
    expect(cleanJobTitle('Senior Project Manager ($150k-$190k)')).toBe('Senior Project Manager')
  })

  it('never returns an empty or near-empty title', () => {
    expect(cleanJobTitle('$150k')).toBe('$150k')
    expect(cleanJobTitle('---$120k---')).toBe('---$120k---')
  })
})
