import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Logo } from '@/components/brand/Logo'
import { LOGO_ART } from '@/components/brand/logoArt'

describe('Logo', () => {
  it('renders each variant as a labelled inline vector that follows the text colour', () => {
    for (const variant of Object.keys(LOGO_ART) as Array<keyof typeof LOGO_ART>) {
      const html = renderToStaticMarkup(createElement(Logo, { variant }))
      expect(html).toContain('role="img"')
      expect(html).toContain('aria-label="Six Figure Jobs"')
      expect(html).toContain('currentColor')
      expect(html).toContain(`viewBox="${LOGO_ART[variant].viewBox}"`)
    }
  })
  it('only the tagged lockup carries the $100,000+ pill', () => {
    expect(LOGO_ART['stacked-tag'].inner).toContain('<rect')
    expect(LOGO_ART.stacked.inner).not.toContain('<rect')
    expect(LOGO_ART.wide.inner).not.toContain('<rect')
  })
})
