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

  it('does not offer a careers-site line as a tagline to restate', () => {
    expect(planProfileFill(empty, { description: 'Join the team putting AI to work for people. Explore ServiceNow careers.' }, undefined).taglineForDescription).toBeUndefined()
    expect(planProfileFill(empty, { description: 'We are hiring! Work with us to build the future of payments.' }, undefined).taglineForDescription).toBeUndefined()
    expect(planProfileFill(empty, { description: 'Stripe is a financial services platform that helps businesses accept payments.' }, undefined).taglineForDescription).toBeDefined()
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
  it('rejects what the first dry run let through: ad lines, offers, copied taglines, no company name', () => {
    expect(validateCompanyDescription('Run payments and offer financial products in one platform.', 'Adyen', 'Run payments, manage your data, and offer financial products in one platform. Adyen is purpose-built.').ok).toBe(false)
    expect(validateCompanyDescription('Affirm provides flexible payment options with longer plans and no fees.', 'Affirm', 'Buy now pay later without the fees. Flexible payment options with longer plans, lower payments, and no fees.').ok).toBe(false)
    expect(validateCompanyDescription('Robinhood provides commission-free investing and advanced trading tools.', 'Robinhood', 'Trade stocks on Robinhood with commission-free investing & advanced trading tools.').ok).toBe(false)
    expect(validateCompanyDescription('Rocket Lab delivers reliable launch services, spacecraft, and satellite components.', 'Rocket Lab', 'The end-to-end space company delivering reliable launch services, spacecraft, satellite components.').ok).toBe(false)
    expect(validateCompanyDescription('Scale AI delivers proven data, evaluations, and outcomes to AI labs.', 'Scale AI', 'Scale delivers proven data, evaluations, and outcomes to AI labs, governments, and the Fortune 500.').ok).toBe(false)
    const adCopy = 'Legora is the collaborative AI powering lawyers to review and research faster, draft smarter, and advise with precision.'
    expect(validateCompanyDescription(adCopy, 'Legora', `${adCopy} Legora adapts to your ways of working.`).ok).toBe(false)
    const copied = 'Legora is a collaborative AI platform for lawyers who review and research documents.'
    expect(validateCompanyDescription(copied, 'Legora', `${copied} Legora adapts to your ways of working.`)).toEqual({ ok: false, reason: 'copied from the tagline' })
    expect(validateCompanyDescription('Datadog provides cloud monitoring as a service solution.', 'Datadog', 'See metrics from all of your apps, tools & services in one place with Datadog’s cloud monitoring as a service solution. Try it for free.').ok).toBe(true)
  })
  it('rejects a second sentence: the tagline\'s ad line with no company name', () => {
    const tagline = 'Databricks offers a unified platform for data, analytics and AI. Build better AI with a data-centric approach. Simplify ETL, data warehousing, governance and AI on the Data + AI Platform.'
    const r = validateCompanyDescription('Databricks offers a unified platform for data, analytics and AI. Simplify ETL, data warehousing, governance and AI on the Data + AI Platform.', 'Databricks', tagline)
    expect(r).toEqual({ ok: false, reason: 'more than one sentence' })
    expect(validateCompanyDescription('Databricks provides a unified platform for data, analytics and AI.', 'Databricks', tagline).ok).toBe(true)
  })
  it('builds a prompt that carries the rules and the text', () => {
    const p = buildCompanyDescriptionPrompt('Prefect', tagline)
    expect(p).toContain('ONLY the text below')
    expect(p).toContain(tagline)
  })
})
