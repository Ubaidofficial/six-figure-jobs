import { structureDescription } from '../../lib/jobs/descriptionStructure'

describe('structureDescription', () => {
  it('splits at the posting\'s own headings, with the text before the first one as "Overview"', () => {
    const { sections } = structureDescription(
      '<p>Intro about the team.</p><ul><li>Build things</li></ul><h3>Minimum qualifications:</h3><ul><li>8 years</li></ul><h3>Preferred qualifications:</h3><ul><li>PhD</li></ul>',
    )
    expect(sections.map((s) => s.title)).toEqual(['Overview', 'Minimum qualifications', 'Preferred qualifications'])
    expect(sections[0].html).toContain('Build things')
    expect(sections[1].html).toBe('<ul><li>8 years</li></ul>')
    expect(sections.map((s) => s.id)).toEqual(['desc-overview', 'desc-minimum-qualifications', 'desc-preferred-qualifications'])
  })

  it('returns no sections when there is nothing to label, so the text stays one block', () => {
    expect(structureDescription('<p>Just one paragraph with no headings.</p>').sections).toEqual([])
    expect(structureDescription('').sections).toEqual([])
    expect(structureDescription('<h3>Empty heading</h3>').sections).toEqual([])
  })

  it('drops a heading with nothing under it and keeps ids unique when titles repeat', () => {
    const { sections } = structureDescription('<h3>Benefits</h3><h3>Benefits</h3><p>Health</p><h3>Benefits:</h3><p>Equity</p>')
    expect(sections.map((s) => s.id)).toEqual(['desc-benefits', 'desc-benefits-2'])
  })

  it('folds equal-opportunity and privacy boilerplate, and nothing else', () => {
    const { sections } = structureDescription(
      '<h3>What you will do</h3><p>Ship.</p><h3>Equal Opportunity Employer</h3><p>We are an EEO employer.</p><h3>Privacy notice</h3><p>Data.</p><h3>Benefits</h3><p>Health.</p>',
    )
    expect(sections.map((s) => [s.title, s.folded])).toEqual([
      ['What you will do', false],
      ['Equal Opportunity Employer', true],
      ['Privacy notice', true],
      ['Benefits', false],
    ])
  })

  it('folds the plural "Equal Opportunities" statement and recruitment-scam warnings too', () => {
    const { sections } = structureDescription(
      '<h3>Role</h3><p>Ship.</p><h3>Equal Opportunities Statement</h3><p>x</p><h3>Protecting Yourself from Recruitment Scams</h3><p>y</p>',
    )
    expect(sections.map((x) => x.folded)).toEqual([false, true, true])
  })
})

import { classifySectionTitle, groupDescription } from '../../lib/jobs/descriptionStructure'

describe('classifySectionTitle', () => {
  it('puts qualification-style headings in requirements and perk-style ones in benefits', () => {
    expect(classifySectionTitle('Minimum qualifications')).toBe('requirements')
    expect(classifySectionTitle('Preferred qualifications')).toBe('requirements')
    expect(classifySectionTitle('What you’ll bring')).toBe('requirements')
    expect(classifySectionTitle('Who you are')).toBe('requirements')
    expect(classifySectionTitle('Nice to have')).toBe('requirements')
    expect(classifySectionTitle('Benefits and perks')).toBe('benefits')
    expect(classifySectionTitle('What we offer')).toBe('benefits')
    expect(classifySectionTitle('Compensation and benefits')).toBe('benefits')
    expect(classifySectionTitle('Pay range')).toBe('benefits')
    // headings seen on 300 live postings that the first version of the patterns missed
    for (const title of ['You Have', 'You are', 'You Might Also Have', 'Required', 'Strong Preferences', 'Bonus Points', 'What You\u2019ve Done'])
      expect(classifySectionTitle(title)).toBe('requirements')
    for (const title of ['What we can offer you', 'An annual incentive bonus plan']) expect(classifySectionTitle(title)).toBe('benefits')
  })

  it('leaves everything else as description', () => {
    expect(classifySectionTitle('About the role')).toBe('description')
    expect(classifySectionTitle('What you will do')).toBe('description')
    expect(classifySectionTitle('Our team')).toBe('description')
    expect(classifySectionTitle('Overview')).toBe('description')
    for (const title of ['You Will', 'What you\u2019ll do', 'Responsibilities', 'WHY THIS ROLE', 'The Role']) expect(classifySectionTitle(title)).toBe('description')
  })
})

describe('groupDescription', () => {
  const s = (title: string, folded = false) => ({ id: `desc-${title.toLowerCase().replace(/\W+/g, '-')}`, title, html: '<p>x</p>', folded })

  it('orders Description, Requirements, Benefits and keeps the posting\'s headings inside them', () => {
    const { groups, folded } = groupDescription([
      s('Overview'),
      s('Benefits'),
      s('Minimum qualifications'),
      s('Preferred qualifications'),
      s('Responsibilities'),
      s('Equal opportunity', true),
    ])
    expect(groups.map((g) => g.title)).toEqual(['Description', 'Requirements', 'Benefits'])
    expect(groups[0].sections.map((x) => x.title)).toEqual(['Overview', 'Responsibilities'])
    expect(groups[1].sections.map((x) => x.title)).toEqual(['Minimum qualifications', 'Preferred qualifications'])
    expect(folded.map((x) => x.title)).toEqual(['Equal opportunity'])
  })

  it('omits a bucket the posting has nothing for (the Google posting has no benefits section)', () => {
    const { groups } = groupDescription([s('Overview'), s('Minimum qualifications'), s('Preferred qualifications')])
    expect(groups.map((g) => g.key)).toEqual(['description', 'requirements'])
  })

  it('returns no groups when everything lands in one bucket, so the flat sections are shown', () => {
    expect(groupDescription([s('Overview'), s('About the team'), s('What you will do')]).groups).toEqual([])
  })
})
