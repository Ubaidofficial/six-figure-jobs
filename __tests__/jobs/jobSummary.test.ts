import { descriptionBlocks, extractBenefits, extractExperience, isCompanyBio, summarizeRole } from '@/lib/jobs/jobSummary'

describe('summarizeRole', () => {
  it('takes the role section, not the company introduction before it', () => {
    const html =
      '<p><strong>About Acme</strong></p><p>Acme is a leading AI company backed by top investors.</p>' +
      '<p><strong>About the role</strong></p><p>You will lead the platform team and own our inference stack. You will hire engineers.</p>'
    expect(summarizeRole(html, { company: 'Acme' })).toBe(
      'You will lead the platform team and own our inference stack. You will hire engineers.',
    )
  })

  it('skips company-bio sentences when there is no role heading', () => {
    const html = '<p>Founded in 2019, Acme has raised $50M. We are looking for a Staff Engineer to build our data platform.</p>'
    expect(summarizeRole(html, { company: 'Acme' })).toBe('We are looking for a Staff Engineer to build our data platform.')
  })

  it('keeps "<Company> is seeking…" (it is about the job) and ends list items as sentences', () => {
    expect(summarizeRole('<p>Midjourney is seeking physicists to develop quantum hardware technologies.</p>', { company: 'Midjourney' })).toBe(
      'Midjourney is seeking physicists to develop quantum hardware technologies.',
    )
    const list = '<p><strong>What you’ll do</strong></p><ul><li>Own the full sales cycle for enterprise accounts</li><li>Build pipeline with partners</li></ul>'
    expect(summarizeRole(list)).toBe('Own the full sales cycle for enterprise accounts. Build pipeline with partners.')
  })

  it('stays within the length limit and returns null for empty input', () => {
    const long = `<p>${'You will build reliable distributed systems for customers. '.repeat(20)}</p>`
    expect((summarizeRole(long, { max: 120 }) ?? '').length).toBeLessThanOrEqual(120)
    expect(summarizeRole('')).toBeNull()
    expect(summarizeRole(null)).toBeNull()
  })

  it('decodes escaped HTML', () => {
    expect(descriptionBlocks('&lt;p&gt;You will ship features weekly.&lt;/p&gt;')[0].text).toBe('You will ship features weekly.')
  })
})

describe('isCompanyBio', () => {
  it('flags company introductions but not sentences addressed to the candidate', () => {
    expect(isCompanyBio('Acme is a leading provider of payments infrastructure.', 'Acme')).toBe(true)
    expect(isCompanyBio('We are backed by Sequoia and a16z.')).toBe(true)
    expect(isCompanyBio('You will own the roadmap for our payments product.')).toBe(false)
  })
})

describe('extractBenefits', () => {
  it('names the benefits a posting states, in a fixed order', () => {
    const html =
      '<h3>Benefits</h3><ul><li>Competitive salary and equity</li><li>Medical, dental and vision insurance</li>' +
      '<li>401(k) with company match</li><li>Unlimited PTO and 16 weeks of parental leave</li><li>Home office stipend</li></ul>'
    expect(extractBenefits(html)).toEqual(['Equity', 'Health insurance', '401(k)', 'Unlimited PTO', 'Parental leave', 'Remote stipend'])
  })

  it('does not read diversity, equity and inclusion or "bonus points" as benefits', () => {
    const html = '<p>We are committed to diversity, equity and inclusion. Bonus points if you know Rust. Pay equity matters to us.</p>'
    expect(extractBenefits(html)).toEqual([])
  })

  it('shows Unlimited PTO instead of Paid time off when both match', () => {
    expect(extractBenefits('<p>Unlimited PTO plus 10 paid holidays.</p>')).toEqual(['Unlimited PTO'])
    expect(extractBenefits('<p>25 days of annual leave.</p>')).toEqual(['Paid time off'])
  })
})

describe('extractExperience', () => {
  it('reads "N+ years", ranges and "at least N years" of experience', () => {
    expect(extractExperience('<li>7+ years experience in Sales Engineering</li>')).toBe('7+ years')
    expect(extractExperience('<li>3-5 years of experience in Big 4 Audit</li>')).toBe('3–5 years')
    expect(extractExperience('<p>At least 2 years of software engineering experience</p>')).toBe('2+ years')
    expect(extractExperience('<li>10+ years of growth marketing experience, with at least 4 years leading teams</li>')).toBe('10+ years')
  })

  it('ignores years that are not an experience requirement', () => {
    expect(extractExperience('<p>Founded 10 years ago, we have grown to 500 people.</p>')).toBeNull()
    expect(extractExperience('<p>A 4-year degree in computer science.</p>')).toBeNull()
    expect(extractExperience('')).toBeNull()
  })
})
