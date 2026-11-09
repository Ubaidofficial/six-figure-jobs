import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

jest.mock('@/components/ui/AnimatedNumber.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_t, key) => String(key) }),
}))

import { AnimatedNumber, formatNumberText, parseNumberText } from '@/components/ui/AnimatedNumber'

describe('parseNumberText', () => {
  it('finds the first run of digits and keeps what surrounds it', () => {
    expect(parseNumberText('3,874')).toEqual({ pre: '', post: '', value: 3874, grouped: true })
    expect(parseNumberText('$150k')).toEqual({ pre: '$', post: 'k', value: 150, grouped: false })
    expect(parseNumberText('+8')).toEqual({ pre: '+', post: '', value: 8, grouped: false })
  })

  it('returns null for text with no number or with a decimal, which is not a count', () => {
    expect(parseNumberText('new')).toBeNull()
    expect(parseNumberText('4.5')).toBeNull()
  })
})

describe('formatNumberText', () => {
  it('rounds, and groups thousands only where the original did', () => {
    const grouped = parseNumberText('1,404,073')!
    expect(formatNumberText(grouped, 1234.6)).toBe('1,235')
    expect(formatNumberText(grouped, 0)).toBe('0')
    expect(formatNumberText(parseNumberText('$150k')!, 75)).toBe('$75k')
    expect(formatNumberText(parseNumberText('2024')!, 2000)).toBe('2000')
  })
})

describe('AnimatedNumber', () => {
  it('renders the final value in the server HTML, so crawlers and no-JS visitors read the real number', () => {
    expect(renderToStaticMarkup(createElement(AnimatedNumber, { text: '54,227', reveal: true }))).toBe(
      '<span class="number">54,227</span>',
    )
  })

  it('adds a caller class next to its own', () => {
    expect(renderToStaticMarkup(createElement(AnimatedNumber, { text: '12', className: 'big' }))).toContain('class="number big"')
  })
})
