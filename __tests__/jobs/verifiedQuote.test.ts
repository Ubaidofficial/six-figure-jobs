import { plainPostingText, splitSentences, verifyQuote } from '../../lib/jobs/verifiedQuote'

describe('plainPostingText', () => {
  it('keeps list items and paragraphs on separate lines and decodes entities', () => {
    expect(plainPostingText('<p>Remote &amp; flexible</p><ul><li>Fluent German</li><li>5+ years</li></ul>')).toBe(
      'Remote & flexible\nFluent German\n5+ years',
    )
  })

  it('handles a description escaped twice', () => {
    expect(plainPostingText('&lt;p&gt;We are fully remote.&lt;/p&gt;')).toBe('We are fully remote.')
  })

  it('returns an empty string for nothing', () => {
    expect(plainPostingText(null)).toBe('')
    expect(plainPostingText(undefined)).toBe('')
  })
})

describe('splitSentences', () => {
  it('splits on sentence ends and line breaks', () => {
    expect(splitSentences('We are remote. You work from home!\nBenefits: health')).toEqual([
      'We are remote.',
      'You work from home!',
      'Benefits: health',
    ])
  })

  it('does not split inside a number or abbreviation followed by lowercase', () => {
    expect(splitSentences('Pay is $1.5k e.g. per month')).toEqual(['Pay is $1.5k e.g. per month'])
  })
})

describe('verifyQuote', () => {
  const source = 'This role is fully remote.  Candidates must be based in the EU — core hours 9–5 CET.'

  it('accepts a verbatim quote, ignoring whitespace and typographic dashes', () => {
    expect(verifyQuote('This role is fully remote.', source)).toBe(true)
    expect(verifyQuote('core hours 9-5 CET', source)).toBe(true)
  })

  it('is case sensitive', () => {
    expect(verifyQuote('THIS ROLE IS FULLY REMOTE', source)).toBe(false)
  })

  it('accepts ... for a skipped middle, in order', () => {
    expect(verifyQuote('This role is ... based in the EU', source)).toBe(true)
    expect(verifyQuote('based in the EU ... This role is', source)).toBe(false)
  })

  it('rejects an invented or a too-short quote', () => {
    expect(verifyQuote('This role is hybrid, three days a week.', source)).toBe(false)
    expect(verifyQuote('remote', source)).toBe(false)
    expect(verifyQuote('', source)).toBe(false)
    expect(verifyQuote('This role is fully remote.', null)).toBe(false)
  })
})
