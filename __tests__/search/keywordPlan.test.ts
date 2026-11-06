import { buildVocabulary } from '../../lib/search/vocabulary'
import {
  WORD_BOUNDARIES,
  buildKeywordPlan,
  correctToken,
  isWholeWord,
  levenshtein,
  scoreJob,
  startsAWord,
  tokenize,
  wordStartPatterns,
} from '../../lib/search/keywordPlan'

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
    expect(correctToken('engin', vocab)).toBeNull() // the start of "engineer"
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

describe('word starts', () => {
  it('startsAWord: the text starts with the term, or the term follows a boundary', () => {
    expect(startsAWord('SEO Manager', 'seo')).toBe(true)
    expect(startsAWord('Head of SEO', 'seo')).toBe(true)
    expect(startsAWord('SEO/AEO Lead', 'aeo')).toBe(true)
    expect(startsAWord('Growth (SEO)', 'seo')).toBe(true)
    expect(startsAWord('Senior Engineering Manager', 'engin')).toBe(true)
    expect(startsAWord('Staff Software Engineer, WarehouseOS', 'seo')).toBe(false)
    expect(startsAWord('Business Development Manager', 'pm')).toBe(false)
  })

  it('isWholeWord: "PM" is a word in "Technical PM" but not in "PMH Nurse Practitioner"', () => {
    expect(isWholeWord('Technical PM', 'pm')).toBe(true)
    expect(isWholeWord('Product Manager (PM)', 'pm')).toBe(true)
    expect(isWholeWord('PMH Nurse Practitioner', 'pm')).toBe(false)
    expect(isWholeWord('Strategy and PMO Director', 'pm')).toBe(false)
    expect(isWholeWord('C++ Developer', 'c++')).toBe(true)
  })

  it('the database patterns and the JavaScript check agree (they must never drift apart)', () => {
    const likeMatch = (text: string, term: string) =>
      wordStartPatterns(term).some((p) =>
        'startsWith' in p ? text.toLowerCase().startsWith(p.startsWith) : text.toLowerCase().includes(p.contains),
      )
    const texts = ['SEO Manager', 'Head of SEO', 'SEO/AEO Lead', 'Growth (SEO)', 'WarehouseOS', 'Seoul Office', 'Lead, SEO & AEO', 'a.seo', 'x|seo', 'say "seo"', 'reseo', 'pm', 'PMO']
    for (const term of ['seo', 'pm', 'aeo', 'engin'])
      for (const text of texts) expect(likeMatch(text, term)).toBe(startsAWord(text, term))
    expect(WORD_BOUNDARIES.length).toBeGreaterThan(5)
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
  it('ranks a whole word above a longer word that starts with it, and a word start above nothing', () => {
    const pm = buildKeywordPlan('pm', null)
    const whole = scoreJob(pm, { title: 'Technical PM' })
    const longer = scoreJob(pm, { title: 'PMH Nurse Practitioner' })
    expect(whole).toBeGreaterThan(longer)
    expect(longer).toBeGreaterThan(scoreJob(pm, { title: 'Welder', skillsJson: '["pmp"]' }))
    expect(scoreJob(pm, { title: 'Business Development Manager' })).toBe(0) // "pm" inside "development" no longer counts
  })
  it('ranks the full phrase of an abbreviation level with the abbreviation ("pm" = "product manager"), but an alias of a full word below it', () => {
    const pm = buildKeywordPlan('pm', null)
    expect(scoreJob(pm, { title: 'Senior Product Manager' })).toBe(scoreJob(pm, { title: 'Technical PM' }))
    const frontend = buildKeywordPlan('frontend', null)
    expect(scoreJob(frontend, { title: 'Frontend Engineer' })).toBeGreaterThan(scoreJob(frontend, { title: 'Front-End Engineer' }))
  })
  it('scores an unrelated job zero', () => {
    expect(scoreJob(plan, { title: 'Account Executive', company: 'Foo' })).toBe(0)
  })
})
