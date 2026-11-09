import { displayKeyword } from '../../lib/search/displayKeyword'

describe('displayKeyword', () => {
  it('capitalises words and upper-cases known acronyms', () => {
    expect(displayKeyword('seo')).toBe('SEO')
    expect(displayKeyword('seo manager')).toBe('SEO Manager')
    expect(displayKeyword('machine learning engineer')).toBe('Machine Learning Engineer')
    expect(displayKeyword('ai product manager')).toBe('AI Product Manager')
  })

  it('keeps words the visitor typed with capitals', () => {
    expect(displayKeyword('iOS developer')).toBe('iOS Developer')
    expect(displayKeyword('React Native')).toBe('React Native')
    expect(displayKeyword('DevOps')).toBe('DevOps')
  })

  it('collapses extra whitespace and tolerates empty input', () => {
    expect(displayKeyword('  data   scientist ')).toBe('Data Scientist')
    expect(displayKeyword('   ')).toBe('')
  })

  it('does not touch acronym lookalikes inside longer words', () => {
    expect(displayKeyword('item')).toBe('Item')
    expect(displayKeyword('hrt specialist')).toBe('Hrt Specialist')
  })
})
