import { normalizeLocationRaw, hasMultiLocationSignals } from '../locationRaw'

describe('normalizeLocationRaw', () => {
  test('converts bullet separator to pipe', () => {
    expect(normalizeLocationRaw('San Francisco, CA • New York, NY • United States'))
      .toBe('san francisco, ca | new york, ny | united states')
  })
})

describe('hasMultiLocationSignals', () => {
  test('does NOT treat normal city/state/country as multi', () => {
    const lr = normalizeLocationRaw('San Francisco, California, United States')
    expect(hasMultiLocationSignals(lr)).toBe(false)
  })

  test('treats bullet list as multi (after normalization)', () => {
    const lr = normalizeLocationRaw('San Francisco, CA • New York, NY • United States')
    expect(hasMultiLocationSignals(lr)).toBe(true)
  })

  test('treats semicolon list as multi', () => {
    const lr = normalizeLocationRaw('Remote, Canada; Remote, US')
    expect(hasMultiLocationSignals(lr)).toBe(true)
  })

  test('treats long comma list as multi', () => {
    const lr = normalizeLocationRaw('A, B, C, D')
    expect(hasMultiLocationSignals(lr)).toBe(true)
  })
})
