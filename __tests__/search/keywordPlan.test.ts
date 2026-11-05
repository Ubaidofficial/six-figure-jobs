import { buildVocabulary } from '../../lib/search/vocabulary'
import { buildKeywordPlan, correctToken, levenshtein, scoreJob, tokenize } from '../../lib/search/keywordPlan'

const row = (title: string, company = 'Acme', skills: string[] = []) => ({
  title,
  company,
  locationRaw: 'New York, US',
  techStack: null,
  skillsJson: JSON.stringify(skills),
})

const vocab = buildVocabulary([
  row('Senior Software Engineer', 'Stripe', ['python', 'react', 'kubernetes']),
  row('Staff Data Scientist', 'Datadog', ['python', 'sql']),
  row('Product Manager', 'Linear', ['figma']),
  row('Engineering Manager', 'Atlassian', ['typescript', 'kubernetes']),
])

describe('tokenize', () => {
  it('drops stopwords and 1-character tokens, keeps tech punctuation, caps at 6', () => {
    expect(tokenize('the Senior C++ jobs in node.js')).toEqual(['senior', 'c++', 'node.js'])
    expect(tokenize('a b c d e f g h i j').length).toBeLessThanOrEqual(6)
  })
  it('falls back to the raw phrase when everything is a stopword', () => {
    expect(tokenize('remote jobs')).toEqual(['remote jobs'])
  })
})

describe('levenshtein', () => {
  it('measures edits and gives up early past the limit', () => {
    expect(levenshtein('python', 'pyton', 2)).toBe(1)
    expect(levenshtein('engineer', 'enginer', 2)).toBe(1)
    expect(levenshtein('abc', 'xyz', 1)).toBeGreaterThan(1)
  })
})

describe('correctToken', () => {
  it('fixes a one-letter typo in a long word', () => {
    expect(correctToken('pyton', vocab)).toBe('python')
    expect(correctToken('enginer', vocab)).toBe('engineer')
    expect(correctToken('kubernetis', vocab)).toBe('kubernetes')
  })
  it('leaves words that already match (including partial words) alone', () => {
    expect(correctToken('python', vocab)).toBeNull()
    expect(correctToken('engin', vocab)).toBeNull() // substring of "engineer"
  })
  it('does not "correct" short words, words with digits, or words with no close neighbour', () => {
    expect(correctToken('pyt', vocab)).toBeNull()
    expect(correctToken('web3', vocab)).toBeNull()
    expect(correctToken('zzzzzz', vocab)).toBeNull()
  })
  it('requires the first letter to match', () => {
    expect(correctToken('xython', vocab)).toBeNull()
  })
})

describe('buildKeywordPlan', () => {
  it('adds aliases both ways', () => {
    const plan = buildKeywordPlan('frontend', vocab)
    expect(plan.terms[0].variants).toEqual(expect.arrayContaining(['frontend', 'front-end', 'front end']))
    expect(buildKeywordPlan('swe', vocab).terms[0].variants).toContain('software engineer')
  })
  it('records typo corrections for the "showing results for" notice', () => {
    const plan = buildKeywordPlan('senior pyton engineer', vocab)
    expect(plan.corrections).toEqual([{ from: 'pyton', to: 'python' }])
    expect(plan.terms[1].variants).toContain('python')
  })
  it('works without a vocabulary', () => {
    expect(buildKeywordPlan('pyton', null).corrections).toEqual([])
  })
})

describe('scoreJob', () => {
  const plan = buildKeywordPlan('python', vocab)
  it('ranks a title match above a company match above a skills match above a location match', () => {
    const title = scoreJob(plan, { title: 'Python Engineer', company: 'X' })
    const company = scoreJob(plan, { title: 'Engineer', company: 'Python Labs' })
    const skills = scoreJob(plan, { title: 'Engineer', company: 'X', skillsJson: '["python"]' })
    const loc = scoreJob(plan, { title: 'Engineer', company: 'X', locationRaw: 'Python Valley' })
    expect(title).toBeGreaterThan(company)
    expect(company).toBeGreaterThan(skills)
    expect(skills).toBeGreaterThan(loc)
    expect(loc).toBeGreaterThan(0)
  })
  it('prefers an exact word to a typo correction, and rewards matching every term in the title', () => {
    const typo = buildKeywordPlan('pyton', vocab)
    expect(scoreJob(plan, { title: 'Python Dev' })).toBeGreaterThan(scoreJob(typo, { title: 'Python Dev' }))
    const two = buildKeywordPlan('senior engineer', vocab)
    expect(scoreJob(two, { title: 'Senior Software Engineer' })).toBeGreaterThan(
      scoreJob(two, { title: 'Software Engineer', skillsJson: '["senior"]' }),
    )
  })
  it('scores an unrelated job zero', () => {
    expect(scoreJob(plan, { title: 'Account Executive', company: 'Foo' })).toBe(0)
  })
})
