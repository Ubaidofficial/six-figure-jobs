import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

jest.mock('@/components/listing/RelatedSearches.module.css', () => new Proxy({}, { get: (_t, key) => String(key) }))
jest.mock('@/components/ui/Link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
    createElement('a', { href, className }, children as never),
}))

import { RelatedSearches } from '@/components/listing/RelatedSearches'

describe('RelatedSearches', () => {
  it('lists each link with its formatted count', () => {
    const html = renderToStaticMarkup(
      createElement(RelatedSearches, {
        items: [
          { label: 'Remote Engineering Jobs', href: '/remote/engineering', count: 2467 },
          { label: 'Guide', href: '/salary/x' },
        ],
      }),
    )
    expect(html).toContain('Related searches')
    expect(html).toContain('href="/remote/engineering"')
    expect(html).toContain('2,467')
    expect(html.match(/<li/g)).toHaveLength(2)
  })

  it('renders nothing without items', () => {
    expect(renderToStaticMarkup(createElement(RelatedSearches, { items: [] }))).toBe('')
  })
})
