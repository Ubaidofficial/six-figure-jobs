import { buildCompanyDescriptionPrompt, homepageOf, planProfileFill, validateCompanyDescription } from '../../lib/companies/profileFill'

const empty = { foundedYear: null, linkedinUrl: null, description: null }

describe('homepageOf', () => {
  it('returns the company origin and rejects job boards and LinkedIn', () => {
    expect(homepageOf('harness.io/careers')).toBe('https://harness.io/')
    expect(homepageOf('https://ats.rippling.com/acme/jobs')).toBeNull()
    expect(homepageOf('secure7.saashr.com')).toBeNull()
    expect(homepageOf('https://rippling.com')).toBe('https://rippling.com/')
    expect(homepageOf('https://www.linkedin.com/company/acme')).toBeNull()
    expect(homepageOf(null)).toBeNull()
  })
})

describe('planProfileFill', () => {
  it('prefers the site for the founding year, then Wikidata', () => {
    expect(planProfileFill(empty, { foundingYear: 2017 }, { foundingYear: 2015 }).foundedYear).toEqual({ value: 2017, source: 'site' })
    expect(planProfileFill(empty, {}, { foundingYear: 2015 }).foundedYear).toEqual({ value: 2015, source: 'wikidata' })
    expect(planProfileFill(empty, {}, undefined).foundedYear).toBeUndefined()
  })

  it('never plans a field that already has a value', () => {
    const plan = planProfileFill({ foundedYear: 2000, linkedinUrl: 'https://www.linkedin.com/company/x', description: 'Already here' }, { foundingYear: 2017, linkedinUrl: 'https://www.linkedin.com/company/y', description: 'tagline tagline tagline tagline tagline tagline' }, { foundingYear: 2015 })
    expect(plan).toEqual({})
  })

  it('rejects a year outside 1800..now and a non-company LinkedIn link', () => {
    expect(planProfileFill(empty, { foundingYear: 1500 }, { foundingYear: 3000 }).foundedYear).toBeUndefined()
    expect(planProfileFill(empty, { linkedinUrl: 'https://www.linkedin.com/in/someone' }, undefined).linkedinUrl).toBeUndefined()
    expect(planProfileFill(empty, { linkedinUrl: 'https://www.linkedin.com/company/acme-co' }, undefined).linkedinUrl).toEqual({ value: 'https://www.linkedin.com/company/acme-co', source: 'site' })
  })

  it('offers the tagline only when there is no description', () => {
    expect(planProfileFill(empty, { description: 'A tagline long enough to be a description here.' }, undefined).taglineForDescription).toMatch(/tagline/)
    expect(planProfileFill({ ...empty, description: '  ' }, { description: 'A tagline long enough to be a description here.' }, undefined).taglineForDescription).toBeDefined()
  })
})

describe('validateCompanyDescription', () => {
  const tagline = 'Workflow orchestration for data pipelines and AI agents. Prefect, Dagster and FastMCP give agents trusted context.'
  it('accepts a restatement that adds nothing', () => {
    expect(validateCompanyDescription('Prefect provides workflow orchestration for data pipelines and AI agents.', 'Prefect', tagline).ok).toBe(true)
  })
  it('rejects invented names or numbers', () => {
    const r = validateCompanyDescription('Prefect provides workflow orchestration used by 5,000 teams in Berlin.', 'Prefect', tagline)
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.reason).toMatch(/not in the tagline/)
  })
  it('rejects marketing and first-person wording, empty and over-long answers', () => {
    expect(validateCompanyDescription('Prefect is the leading platform for workflow orchestration of data pipelines.', 'Prefect', tagline).ok).toBe(false)
    expect(validateCompanyDescription('Prefect gives you workflow orchestration for data pipelines and agents.', 'Prefect', tagline).ok).toBe(false)
    expect(validateCompanyDescription('', 'Prefect', tagline).ok).toBe(false)
    expect(validateCompanyDescription('x'.repeat(301), 'Prefect', tagline).ok).toBe(false)
    expect(validateCompanyDescription(null, 'Prefect', tagline).ok).toBe(false)
  })
  it('builds a prompt that carries the rules and the text', () => {
    const p = buildCompanyDescriptionPrompt('Prefect', tagline)
    expect(p).toContain('ONLY the text below')
    expect(p).toContain(tagline)
  })
})
