import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockClassNames = () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) })
jest.mock('@/components/home/Hero.module.css', () => mockClassNames())
jest.mock('@/components/ui/AnimatedNumber.module.css', () => mockClassNames())

import { HeroSalaryBands, type HeroBand } from '@/components/home/HeroSalaryBands'

const sample = (id: string, title: string) => ({
  id,
  href: `/job/${id}`,
  title,
  company: 'Acme',
  logo: null,
  salary: '$160k–$190k',
  location: 'Austin',
  countryCode: 'US',
  addedAt: '2026-11-06T10:00:00.000Z',
})

const bands: HeroBand[] = [
  { label: '$100k–$150k', count: 400, href: '/jobs/100k-plus', samples: [sample('a', 'Backend Engineer')] },
  { label: '$150k–$200k', count: 1200, href: '/jobs?minSalary=150000', samples: [sample('b', 'Staff Engineer'), sample('c', 'Data Lead')] },
  { label: '$200k–$300k', count: 300, href: '/jobs/200k-plus', samples: [] },
  { label: '$300k+', count: 40, href: '/jobs?minSalary=300000', samples: [] },
]
const html = renderToStaticMarkup(createElement(HeroSalaryBands, { bands }))

describe('HeroSalaryBands', () => {
  it('starts on the band with the most roles and says how many pay in it', () => {
    expect(html).toContain('aria-pressed="true"')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toMatch(/<span class="number">1,200<\/span> roles pay \$150k–\$200k/)
  })

  it('keeps every band\'s roles and "see all" link in the HTML, hiding all but the picked band', () => {
    expect(html).toContain('href="/job/a"')
    expect(html).toContain('href="/job/b"')
    expect(html).toContain('href="/jobs/200k-plus"')
    expect(html).toContain('href="/jobs?minSalary=300000"')
    const panels = html.match(/<div [^>]*id="hero-band-\d"[^>]*>/g) ?? []
    expect(panels).toHaveLength(4)
    expect(panels.filter((p) => p.includes('hidden'))).toHaveLength(3)
    expect(panels[1]).not.toContain('hidden')
  })

  it('shows each band\'s count on its bar, with thousands separators', () => {
    expect(html).toContain('<span class="barCount">1,200</span>')
    expect(html).toContain('<span class="barCount">40</span>')
  })

  it('shows only the link for a band with no recent example roles', () => {
    const panel = html.match(/<div [^>]*id="hero-band-3"[^>]*>.*?<\/div>/)?.[0] ?? ''
    expect(panel).not.toContain('<ul')
    expect(panel).toContain('See all $300k+ roles')
  })

  it('links the example roles without prefetching them', () => {
    // prefetch={false} leaves no attribute in the HTML; what matters is that these are plain links to the job pages.
    expect(html).toMatch(/<a class="bandJob" href="\/job\/b">/)
  })
})
