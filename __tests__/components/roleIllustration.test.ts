import fs from 'fs'
import path from 'path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  RoleIllustration,
  ROLE_ART_KEYS,
  resolveRoleArt,
} from '@/components/roles/RoleIllustration'
import { isCanonicalSlug } from '@/lib/roles/canonicalSlugs'

/** The slugs the homepage role cards are built from (PREMIUM_ROLE_DEFS in app/page.tsx). */
function homepageCardSlugs(): string[] {
  const src = fs.readFileSync(path.join(__dirname, '../../app/page.tsx'), 'utf8')
  const block = /const PREMIUM_ROLE_DEFS = \[([\s\S]*?)\] as const/.exec(src)
  if (!block) throw new Error('PREMIUM_ROLE_DEFS not found in app/page.tsx')
  return [...block[1].matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1])
}

const render = (props: Parameters<typeof RoleIllustration>[0]) =>
  renderToStaticMarkup(createElement(RoleIllustration, props))

describe('RoleIllustration', () => {
  const cardSlugs = homepageCardSlugs()

  it('finds the homepage role-card slugs, and they are real roles', () => {
    expect(cardSlugs.length).toBeGreaterThanOrEqual(8)
    for (const slug of cardSlugs) expect(isCanonicalSlug(slug)).toBe(true)
  })

  it('gives every homepage card slug its own illustration, not the fallback', () => {
    for (const slug of cardSlugs) expect(resolveRoleArt(slug)).not.toBe('generic')
    // the eight cards show eight different pictures
    expect(new Set(cardSlugs.map(resolveRoleArt)).size).toBe(cardSlugs.length)
  })

  it('maps seniority variants to the same art as the base role', () => {
    expect(resolveRoleArt('senior-backend-engineer')).toBe(resolveRoleArt('backend-engineer'))
    expect(resolveRoleArt('principal-data-scientist')).toBe(resolveRoleArt('data-scientist'))
  })

  it('falls back to the generic illustration for unknown or empty slugs', () => {
    for (const slug of ['not-a-role', 'staff-accountant', 'other', '', null, undefined]) {
      expect(resolveRoleArt(slug)).toBe('generic')
    }
    expect(render({ slug: 'not-a-role' })).toBe(render({ art: 'generic' }))
  })

  it('renders every illustration as a sized, decorative, text-free SVG', () => {
    for (const art of ROLE_ART_KEYS) {
      const html = render({ art, size: 88 })
      expect(html).toMatch(/^<svg /)
      expect(html).toContain('aria-hidden="true"')
      expect(html).toContain('focusable="false"')
      expect(html).toContain('width="88"')
      expect(html).toContain('height="88"')
      expect(html).toContain('viewBox="0 0 120 120"')
      expect(html).not.toContain('<text')
      // every gradient/filter the art references is defined in the same SVG
      const refs = new Set([...html.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]))
      for (const id of refs) expect(html).toContain(`id="${id}"`)
    }
  })

  it('uses distinct gradient ids per instance so two copies never clash', () => {
    const ids = (html: string) => [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])
    const both = renderToStaticMarkup(
      createElement('div', null, createElement(RoleIllustration, { art: 'software' }), createElement(RoleIllustration, { art: 'software' })),
    )
    const all = ids(both)
    expect(new Set(all).size).toBe(all.length)
  })
})
