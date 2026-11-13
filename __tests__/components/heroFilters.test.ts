import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/home/HeroFilters.module.css', () => mockClassNames())
jest.mock('@/components/filters/FilterPills.module.css', () => mockClassNames())

import { HeroFilters, withCount } from '@/components/home/HeroFilters'

const props = {
  roles: [{ value: 'software-engineer', label: 'Software Engineer' }],
  locations: [
    { value: 'DE', label: 'Germany' },
    { value: 'FR', label: 'France' },
  ],
  remoteRegions: [
    { value: 'global', label: 'Worldwide' },
    { value: 'europe', label: 'Europe' },
  ],
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('withCount', () => {
  it('adds a formatted count, and leaves the label alone when there is nothing to promise', () => {
    expect(withCount('Germany', 1204)).toBe('Germany (1,204)')
    expect(withCount('Germany', 0)).toBe('Germany')
    expect(withCount('Germany', undefined)).toBe('Germany')
    expect(withCount('Germany', null)).toBe('Germany')
  })
})

describe('HeroFilters counts', () => {
  it('shows live counts on countries, worldwide remote and work type', () => {
    const t = text(
      renderToStaticMarkup(
        createElement(HeroFilters, {
          ...props,
          counts: { countries: { DE: 1204 }, remoteWorldwide: 310, workType: { remote: 5000, hybrid: 900, onsite: 0 } },
        }),
      ),
    )
    expect(t).toContain('Germany (1,204)')
    expect(t).toContain('France')
    expect(t).not.toContain('France (')
    expect(t).toContain('Anywhere in the world (remote) (310)')
    expect(t).toContain('Remote (5,000)')
    expect(t).toContain('Hybrid (900)')
    expect(t).not.toContain('On-site (')
  })

  it('renders unchanged labels when counts are not available', () => {
    const t = text(renderToStaticMarkup(createElement(HeroFilters, { ...props, counts: null })))
    expect(t).toContain('Germany')
    expect(t).not.toMatch(/\(\d/)
  })
})
