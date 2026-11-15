import { existsSync } from 'fs'
import { join } from 'path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Logo } from '@/components/brand/Logo'
import { LOGO_ART } from '@/components/brand/logoArt'

describe('Logo', () => {
  it('renders each variant as a real, labelled image file that can be right-click saved', () => {
    for (const variant of Object.keys(LOGO_ART) as Array<keyof typeof LOGO_ART>) {
      const html = renderToStaticMarkup(createElement(Logo, { variant }))
      expect(html).toContain('<img')
      expect(html).toContain('alt="Six Figure Jobs"')
      expect(html).toContain(`src="/brand/logo-${variant}-light.svg"`)
      expect(existsSync(join(process.cwd(), 'public/brand', `logo-${variant}-light.svg`))).toBe(true)
    }
  })
  it('only the tagged lockup carries the $100,000+ pill', () => {
    expect(LOGO_ART['stacked-tag'].inner).toContain('<rect')
    expect(LOGO_ART.stacked.inner).not.toContain('<rect')
    expect(LOGO_ART.wide.inner).not.toContain('<rect')
  })
})
