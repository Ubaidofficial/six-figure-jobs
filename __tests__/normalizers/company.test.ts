import { cleanCompanyName, decodeNameEntities } from '../../lib/normalizers/company'

describe('decodeNameEntities', () => {
  it('decodes the numeric and named entities feeds send in company names', () => {
    expect(decodeNameEntities('Quest Defense Systems &#038; Solutions, Inc.')).toBe('Quest Defense Systems & Solutions, Inc.')
    expect(decodeNameEntities('AT&amp;T')).toBe('AT&T')
    expect(decodeNameEntities('Ben &#x26; Jerry&#39;s')).toBe("Ben & Jerry's")
    expect(decodeNameEntities('Acme&nbsp;Corp')).toBe('Acme Corp')
  })
  it('leaves plain text, a bare ampersand and unknown or out-of-range entities alone', () => {
    expect(decodeNameEntities('Johnson & Johnson')).toBe('Johnson & Johnson')
    expect(decodeNameEntities('Fish &chips; Ltd')).toBe('Fish &chips; Ltd')
    expect(decodeNameEntities('X &#0; Y')).toBe('X &#0; Y')
    expect(decodeNameEntities('X &#99999999; Y')).toBe('X &#99999999; Y')
  })
})

describe('cleanCompanyName', () => {
  it('stores the decoded name, so "&#038;" never reaches a page or makes a second company', () => {
    expect(cleanCompanyName('Quest Defense Systems &#038; Solutions, Inc.')).toBe('Quest Defense Systems & Solutions, Inc.')
    expect(cleanCompanyName('Acme&nbsp;&nbsp;Corp')).toBe('Acme Corp')
  })
  it('still rejects placeholders and trims noise', () => {
    expect(cleanCompanyName('Remote')).toBeNull()
    expect(cleanCompanyName('  Figma  ')).toBe('Figma')
  })
})
