import {
  cleanJobDescriptionHtml,
  cleanJobDescriptionText,
  findJobDescriptionNoiseMatches,
  hasJobDescriptionNoise,
  isFullerDescription,
  sanitizeJobDescriptionFields,
} from '../../lib/jobs/descriptionCleaning'

describe('descriptionCleaning', () => {
  it('removes known privacy boilerplate from plain text', () => {
    const cleaned = cleanJobDescriptionText(
      "Job Applicant Privacy Notice\nPersonal Information We Collect\nYour Privacy Choices\nBuild core backend systems.",
    )

    expect(cleaned).toBe('Build core backend systems.')
  })

  it('drops board/sidebar noise from HTML descriptions', () => {
    const cleaned = cleanJobDescriptionHtml(
      '<div>Similar Jobs</div><p>Showing</p><p>7</p><p>jobs</p><p>Analytics</p>',
    )

    expect(cleaned).toBe('')
  })

  it('flags remote board marketing/sidebar fragments as noise', () => {
    expect(
      hasJobDescriptionNoise(
        'Meet JobCopilot and browse Similar Jobs. Showing 7 jobs from companies like Acme.',
      ),
    ).toBe(true)
  })

  it('returns stable noise labels for polluted descriptions', () => {
    expect(
      findJobDescriptionNoiseMatches('Similar Jobs. Showing 7 jobs. Explore related pages.'),
    ).toEqual(['similar_jobs', 'showing_jobs_count', 'explore_related_pages'])
  })

  it('sanitizes privacy boilerplate without marking the description as polluted', () => {
    const result = sanitizeJobDescriptionFields(
      '<p>Job Applicant Privacy Notice</p><p>Your Privacy Choices</p><p>Build systems.</p>',
      null,
    )

    expect(result.polluted).toBe(false)
    expect(result.descriptionHtml).toContain('Build systems.')
    expect(result.descriptionText).toBe('Build systems.')
  })
})

describe('stripBreaksInsideLists', () => {
  const { stripBreaksInsideLists } = require('../../lib/jobs/descriptionCleaning')

  it('removes <br> placed directly inside a list', () => {
    expect(stripBreaksInsideLists('<ul><br><li>One</li><br><li>Two</li><br></ul>')).toBe(
      '<ul><li>One</li><li>Two</li></ul>',
    )
  })

  it('keeps <br> inside list items and paragraphs', () => {
    const html = '<p>Line<br>break</p><ul><li>One<br>two</li></ul>'
    expect(stripBreaksInsideLists(html)).toBe(html)
  })
})

describe('isFullerDescription', () => {
  const preview = `<p>${'a'.repeat(990)}`

  it('accepts a full text over a ~1,000 character preview, or over nothing', () => {
    expect(isFullerDescription(preview, `<p>${'a'.repeat(4000)}</p>`)).toBe(true)
    expect(isFullerDescription(null, '<p>Something</p>')).toBe(true)
  })

  it('does not replace a description with a shorter, equal or merely re-worded one', () => {
    expect(isFullerDescription(`<p>${'a'.repeat(4000)}</p>`, preview)).toBe(false)
    expect(isFullerDescription(preview, preview)).toBe(false)
    expect(isFullerDescription(preview, `<p>${'a'.repeat(1050)}`)).toBe(false) // +60 chars: not a real gain
    expect(isFullerDescription(preview, '')).toBe(false)
    expect(isFullerDescription(preview, null)).toBe(false)
  })
})
