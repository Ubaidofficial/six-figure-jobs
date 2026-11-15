import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

jest.mock('@/components/ui/Link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
    createElement('a', { href, className }, children as never),
}))

import { BLOG_POSTS } from '@/lib/blog/posts'
import { SENIOR_ROLE_SLUGS, buildBrowseDirectory } from '@/lib/home/browseDirectory'
import { PHASE_1_ROLE_SLUGS } from '@/lib/seo/indexingPhase'
import { getPseoBatch } from '@/lib/seo/pseoBatches'
import { BrowseDirectory } from '@/components/home/BrowseDirectory'

const companies = [
  { slug: 'adobe', name: 'Adobe' },
  { slug: 'anthropic', name: 'Anthropic' },
]
const groups = buildBrowseDirectory(companies)
const group = (title: string) => groups.find((g) => g.title === title)!

describe('homepage link directory', () => {
  it('links every phase-1 role to its remote and salary pages, and nothing outside that list', () => {
    const slugs = [...PHASE_1_ROLE_SLUGS]
    expect(group('Remote jobs by role').links.map((l) => l.href)).toEqual(slugs.map((s) => `/remote/${s}`))
    expect(group('Salary guides by role').links.map((l) => l.href)).toEqual(slugs.map((s) => `/salary/${s}`))
  })

  it('lists only released batch-1 city, skill and senior-role pages (the ones the sitemap advertises)', () => {
    for (const title of ['Jobs by city', 'Jobs by skill', 'Senior roles']) {
      const links = group(title).links
      expect(links.length).toBeGreaterThan(0)
      for (const l of links) expect([title, l.href, getPseoBatch(l.href)]).toEqual([title, l.href, 1])
    }
    expect(group('Senior roles').links).toHaveLength(SENIOR_ROLE_SLUGS.length)
  })

  it('lists exactly the companies it is given, and every blog post', () => {
    expect(group('Companies hiring').links).toEqual([
      { href: '/company/adobe', label: 'Adobe jobs' },
      { href: '/company/anthropic', label: 'Anthropic jobs' },
    ])
    const guides = group('Guides').links.map((l) => l.href)
    expect(guides).toEqual(['/blog', ...BLOG_POSTS.map((p) => `/blog/${p.slug}`)])
  })

  it('leaves out a group with nothing to list, such as companies when none could be read', () => {
    expect(buildBrowseDirectory([]).some((g) => g.title === 'Companies hiring')).toBe(false)
  })

  it('has no duplicate links and no query strings or absolute URLs', () => {
    const hrefs = groups.flatMap((g) => g.links.map((l) => l.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const h of hrefs) expect(h).toMatch(/^\/[a-z0-9\-/]+$/)
  })

  it('renders each group as a heading with a list of links', () => {
    const html = renderToStaticMarkup(createElement(BrowseDirectory, { companies }))
    expect(html).toContain('Companies hiring')
    expect(html).toContain('href="/company/adobe"')
    expect(html).toContain('href="/remote/software-engineer"')
    expect(html.match(/<h3/g)).toHaveLength(groups.length)
  })
})
