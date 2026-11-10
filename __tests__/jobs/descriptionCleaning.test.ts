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

describe('local job-search lists pasted in by job boards', () => {
  // As served for a WhatJobs posting (Data Engineer, Envision Financial, 2026-11-10), shortened.
  const posting = [
    '<p>CA$121,610.00–CA$132,886.00 yearly</p>',
    '<p>The cities near North Cowichan, BC that boast the highest number of engineer jobs are:</p>',
    ...['Vancouver', 'Surrey', 'Victoria', 'Burnaby', 'Richmond', 'Abbotsford', 'Coquitlam', 'Delta', 'Langley', 'Nanaimo'].map(
      (c) => `<p>${c}</p>`,
    ),
    '<p>The 10 cities near North Cowichan, BC that have the most job openings are:</p>',
    '<p>Vancouver</p><p>Surrey</p><p>Ladner</p>',
    '<p class="x">The 10 most popular job searches in North Cowichan, BC are:</p>',
    '<p>server</p><p>software product manager</p><p>it</p>',
    '<p>We are currently seeking a Data Engineer to join our team.</p>',
    '<p>Responsibilities</p>',
  ].join('')

  it('removes the lists and keeps the job', () => {
    expect(cleanJobDescriptionHtml(posting)).toBe(
      '<p>CA$121,610.00–CA$132,886.00 yearly</p><p>We are currently seeking a Data Engineer to join our team.</p><p>Responsibilities</p>',
    )
  })

  it('removes the lists when lines are separated by <br> (as stored for WhatJobs postings)', () => {
    const html = posting.replace(/<p[^>]*>/g, '').replace(/<\/p>/g, '<br><br>')
    expect(cleanJobDescriptionHtml(html)).toBe(
      'CA$121,610.00–CA$132,886.00 yearly<br><br>We are currently seeking a Data Engineer to join our team.<br><br>Responsibilities<br><br>',
    )
  })

  it('never eats part of a longer line that follows a list', () => {
    const html = '<p>The 10 most popular job searches in Austin, TX are:</p><p>server</p><p>We hire engineers to build data systems</p>'
    expect(cleanJobDescriptionHtml(html)).toBe('<p>We hire engineers to build data systems</p>')
  })

  it('takes at most ten items, so a short heading after a full list is kept', () => {
    const items = Array.from({ length: 10 }, (_, i) => `<p>City ${i}</p>`).join('')
    const html = `<p>The 10 cities near Austin, TX that have the most job openings are:</p>${items}<p>Benefits</p>`
    expect(cleanJobDescriptionHtml(html)).toBe('<p>Benefits</p>')
  })

  it('leaves ordinary descriptions alone', () => {
    const html = '<p>The cities near our office are great.</p><p>Vancouver</p>'
    expect(cleanJobDescriptionHtml(html)).toBe(html)
  })
})
