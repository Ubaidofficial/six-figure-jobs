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
})
