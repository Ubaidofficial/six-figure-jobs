import {
  cleanJobDescriptionHtml,
  cleanJobDescriptionText,
  findJobDescriptionNoiseMatches,
  hasJobDescriptionNoise,
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
