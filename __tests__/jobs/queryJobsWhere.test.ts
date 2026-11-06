import { buildWhere } from '../../lib/jobs/queryJobs'
import { buildKeywordPlan } from '../../lib/search/keywordPlan'

const andOf = (where: any) => (Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [])

// The clauses buildWhere adds for the keyword: one OR-group per word, each made of {field: {startsWith|contains}}.
const keywordClauses = (where: any) =>
  andOf(where).filter((c: any) => Array.isArray(c.OR) && c.OR.some((o: any) => o?.title?.startsWith || o?.title?.contains))

// A small interpreter for exactly the operators the keyword clauses use, so a test can ask "would this job match?"
// without a database. Case-insensitive, as the clauses ask (mode: 'insensitive').
function matches(clause: any, row: Record<string, string>): boolean {
  if (Array.isArray(clause.OR)) return clause.OR.some((c: any) => matches(c, row))
  const [field, op] = Object.entries(clause)[0] as [string, any]
  const value = String(row[field] ?? '').toLowerCase()
  if (typeof op.startsWith === 'string') return value.startsWith(op.startsWith.toLowerCase())
  if (typeof op.contains === 'string') return value.includes(op.contains.toLowerCase())
  throw new Error(`unexpected clause ${JSON.stringify(clause)}`)
}
const job = (title: string, extra: Record<string, string> = {}) => ({ title, company: 'Acme', locationRaw: 'Remote', techStack: '', skillsJson: '[]', ...extra })
// queryJobs builds a plan (aliases, typo correction) and hands it to buildWhere; with no vocabulary there are no typo fixes.
const found = (keyword: string, row: Record<string, string>) =>
  keywordClauses(buildWhere({ keyword, keywordPlan: buildKeywordPlan(keyword, null) })).every((c: any) => matches(c, row))

describe('buildWhere keyword search', () => {
  it('searches title, company, location, tech stack and skills', () => {
    const [clause] = keywordClauses(buildWhere({ keyword: 'react' }))
    const fields = new Set(clause.OR.map((o: any) => Object.keys(o)[0]))
    expect(fields).toEqual(new Set(['title', 'company', 'locationRaw', 'techStack', 'skillsJson']))
  })

  it('matches where a word starts with the term: the text starts with it, or it follows a boundary', () => {
    const [clause] = keywordClauses(buildWhere({ keyword: 'react' }))
    const titleOps = clause.OR.filter((o: any) => o.title).map((o: any) => o.title)
    expect(titleOps).toContainEqual({ startsWith: 'react', mode: 'insensitive' })
    expect(titleOps).toContainEqual({ contains: ' react', mode: 'insensitive' })
    expect(titleOps).toContainEqual({ contains: '/react', mode: 'insensitive' })
    expect(titleOps).toContainEqual({ contains: '(react', mode: 'insensitive' })
    // never a bare substring, which is what matched "seo" inside "WarehouseOS"
    expect(titleOps).not.toContainEqual({ contains: 'react', mode: 'insensitive' })
  })

  it('tokenizes multi-word queries into AND-ed per-word matches (order-independent)', () => {
    const clauses = keywordClauses(buildWhere({ keyword: 'senior backend python' }))
    expect(clauses).toHaveLength(3)
    const startsWith = clauses.map((c: any) => c.OR.find((o: any) => o.title?.startsWith).title.startsWith)
    expect(startsWith.sort()).toEqual(['backend', 'python', 'senior'])
  })

  it('drops stopwords so they do not over-filter the query', () => {
    const clauses = keywordClauses(buildWhere({ keyword: 'remote python jobs' }))
    // "remote" + "jobs" are stopwords → only "python" remains
    expect(clauses).toHaveLength(1)
    expect(clauses[0].OR).toEqual(expect.arrayContaining([{ title: { startsWith: 'python', mode: 'insensitive' } }]))
  })
})

describe('what a keyword search finds (the generated filter run against realistic jobs)', () => {
  it('"seo" finds SEO in any position, and no longer the letters inside "WarehouseOS"', () => {
    for (const title of ['SEO Manager', 'Head of SEO', 'SEO/AEO Marketing Lead', 'Staff Data Scientist, SEO & AEO', 'Growth Lead (SEO)', 'Lead - SEO'])
      expect(found('seo', job(title))).toBe(true)
    expect(found('seo', job('Staff Software Engineer, WarehouseOS'))).toBe(false)
  })

  it('"pm" finds PM, PMO and PMP but not the letters inside "development"', () => {
    expect(found('pm', job('Technical PM'))).toBe(true)
    expect(found('pm', job('Strategy and PMO Deputy Director'))).toBe(true)
    expect(found('pm', job('Project Manager', { skillsJson: '["pmp","agile"]' }))).toBe(true)
    for (const title of ['Business Development Manager', 'Welding Estimator', 'Onsite Supervisor']) expect(found('pm', job(title))).toBe(false)
  })

  it('short tech words do not match inside longer words', () => {
    expect(found('ux', job('Senior UX Designer'))).toBe(true)
    expect(found('ux', job('Luxury Retail Manager'))).toBe(false)
    expect(found('ml', job('ML Engineer'))).toBe(true)
    expect(found('ml', job('Front End Developer (HTML, CSS)'))).toBe(false)
  })

  it('typing the start of a word still works', () => {
    expect(found('engin', job('Senior Software Engineer'))).toBe(true)
    expect(found('engin', job('Engineering Manager'))).toBe(true)
    expect(found('market', job('Content Marketing Manager'))).toBe(true)
  })

  it('finds a skill or company word the same way', () => {
    expect(found('python', job('Data Engineer', { skillsJson: '["sql","python"]' }))).toBe(true)
    expect(found('python', job('Data Engineer', { skillsJson: '["cpython-internals"]' }))).toBe(false) // "python" is inside "cpython"
    expect(found('stripe', job('Engineer', { company: 'Stripe' }))).toBe(true)
    expect(found('stripe', job('Engineer', { company: 'Unstripe Labs' }))).toBe(false)
  })

  it('requires every word of a multi-word search, in any order, each as a word start', () => {
    expect(found('backend senior', job('Senior Backend Engineer'))).toBe(true)
    expect(found('backend senior', job('Senior Frontend Engineer'))).toBe(false)
  })

  it('still finds a job through an alias', () => {
    expect(found('frontend', job('Front-End Engineer'))).toBe(true)
    expect(found('swe', job('Software Engineer II'))).toBe(true)
  })
})
