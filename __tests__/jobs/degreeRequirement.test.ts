jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import {
  DEGREE_OPTIONAL_PHRASES,
  DEGREE_PHRASES,
  degreeRequirement,
  noDegreeRequiredWhere,
  phrasesRegex,
} from '@/lib/jobs/degreeRequirement'

describe('degreeRequirement', () => {
  it('reads a plain degree requirement', () => {
    expect(degreeRequirement("<li>Bachelor's degree in Computer Science or a related field.</li>")).toBe('required')
    expect(degreeRequirement('Hold a PhD in machine learning.')).toBe('required')
    expect(degreeRequirement('BS/MS in Computer Science.')).toBe('required')
    // Chewy, 2026-11-09: a veterinarian was listed as needing no degree.
    expect(degreeRequirement("What You'll Need: A Doctor of Veterinary Medicine degree (DVM, VMD) is required")).toBe('required')
    expect(degreeRequirement('J.D. from an accredited law school and active bar membership')).toBe('required')
  })

  it('accepts equivalent experience when the posting ties it to the degree or experience', () => {
    expect(degreeRequirement("Bachelor’s degree or equivalent practical experience")).toBe('equivalent_accepted')
    expect(degreeRequirement('<li>BS in CS, or equivalent experience</li>')).toBe('equivalent_accepted')
    expect(degreeRequirement('<li>BS in Computer Science required</li>')).toBe('required')
    expect(degreeRequirement('PhD or equivalent experience in research')).toBe('equivalent_accepted')
    expect(degreeRequirement("A bachelor's degree, or 2+ years building software in lieu of a degree")).toBe('equivalent_accepted')
    expect(degreeRequirement("Bachelor's degree preferred; no degree required for strong candidates")).toBe('equivalent_accepted')
  })

  // Live examples found on 2026-11-09 while checking the rule.
  it('does not take a tool "or equivalent" as accepting experience instead of the degree', () => {
    expect(degreeRequirement("Bachelor's degree in EE. Testbenches using SystemVerilog/UVM or equivalent methodologies.")).toBe('required')
  })

  it('does not read other uses of "degree" as a requirement', () => {
    expect(degreeRequirement('A high degree of ownership and a 360-degree view of the customer.')).toBe('not_mentioned')
    expect(degreeRequirement(null)).toBe('not_mentioned')
  })
})

describe('phrasesRegex', () => {
  it('takes every character literally', () => {
    const re = new RegExp(phrasesRegex(['ph.d', 'bs/ms']), 'i')
    expect(re.test('Ph.D in physics')).toBe(true)
    expect(re.test('phXd')).toBe(false)
    expect(re.test('BS/MS')).toBe(true)
  })

  it('matches the same postings as the classifier (one rule, two places)', () => {
    const required = new RegExp(phrasesRegex(DEGREE_PHRASES), 'i')
    const optional = new RegExp(phrasesRegex(DEGREE_OPTIONAL_PHRASES), 'i')
    for (const text of [
      "Bachelor's degree in CS",
      "Master’s degree or equivalent",
      'PhD or equivalent experience',
      'SystemVerilog or equivalent methodologies; BS degree',
      'No requirements listed',
    ]) {
      const sqlRequired = required.test(text) && !optional.test(text)
      expect(sqlRequired).toBe(degreeRequirement(text) === 'required')
    }
  })
})

describe('noDegreeRequiredWhere', () => {
  it('lists described jobs created before the pass and not found to require a degree', () => {
    const at = new Date('2026-11-09T12:00:00Z')
    expect(noDegreeRequiredWhere({ ids: ['a', 'b'], classifiedAt: at })).toEqual({
      descriptionHtml: { not: null },
      createdAt: { lte: at },
      id: { notIn: ['a', 'b'] },
    })
    expect(noDegreeRequiredWhere({ ids: [], classifiedAt: at })).not.toHaveProperty('id')
  })
})
