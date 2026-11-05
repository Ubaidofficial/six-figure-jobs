import { knownLeftover, leftoverTokens } from '../../lib/search/leftover'
import { buildVocabulary } from '../../lib/search/vocabulary'

const vocab = buildVocabulary([
  { title: 'Senior Software Engineer', company: 'Stripe', locationRaw: 'Berlin, DE', techStack: null, skillsJson: '["python","react"]' },
  { title: 'Data Scientist', company: 'Datadog', locationRaw: 'London, GB', techStack: null, skillsJson: '["python","sql"]' },
])

describe('leftoverTokens', () => {
  it('keeps words the role/seniority/country parts do not consume', () => {
    expect(leftoverTokens('python developer', ['software-engineer'])).toEqual(['python'])
    expect(leftoverTokens('senior python engineer in germany', ['software-engineer'])).toEqual(['python'])
  })
  it('ignores salary, remote and filler words', () => {
    expect(leftoverTokens('remote 200k software engineer', ['software-engineer'])).toEqual([])
    expect(leftoverTokens('$150k+ python jobs', ['software-engineer'])).toEqual(['python'])
  })
  it('returns nothing when the whole query is the role', () => {
    expect(leftoverTokens('software engineer', ['software-engineer'])).toEqual([])
  })
})

describe('knownLeftover', () => {
  it('keeps words that exist in our jobs or are one typo away, and drops stray words', () => {
    expect(knownLeftover(['python', 'pyton', 'blorptastic'], vocab)).toEqual(['python', 'pyton'])
  })
  it('keeps nothing without a vocabulary, so a stray word can never empty the results', () => {
    expect(knownLeftover(['python'], null)).toEqual([])
  })
})
