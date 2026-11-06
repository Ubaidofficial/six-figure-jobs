// Every literal internal link in the source must point at a page that exists and is not just a redirect.
//
// Static check (no server, no database): routes come from the app/ folder, links from href="/..." and href: '/...' in the
// source. Links built from variables (`/jobs/${slug}`) are out of reach here; the footer and the link constants are
// literals on purpose so they are covered. The live-site crawl for built links is a manual step, not part of this test.

import fs from 'fs'
import path from 'path'

import { FOOTER_COLUMNS } from '@/components/layout/footerLinks'

const ROOT = process.cwd()
// scrapers and ingest hold parser examples such as "/company/job/xxxxx", not links the site renders
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.claude', 'coverage', '__tests__', 'scrapers', 'ingest'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

type Route = { re: RegExp; file: string }

function loadRoutes(): Route[] {
  const appDir = path.join(ROOT, 'app')
  return walk(appDir)
    .filter((f) => /[\\/](page|route)\.(t|j)sx?$/.test(f))
    .map((file) => {
      const segs = path.relative(appDir, path.dirname(file)).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith('@'))
      const body = segs
        .map((s) => {
          if (/^\[\[\.\.\..+\]\]$/.test(s)) return '(?:/.*)?'
          if (/^\[\.\.\..+\]$/.test(s)) return '/.+'
          if (/^\[.+\]$/.test(s)) return '/[^/]+'
          return '/' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        })
        .join('')
      return { re: new RegExp(`^${body || '/'}/?$`), file }
    })
}

const routes = loadRoutes()
const routeFor = (p: string) => routes.find((r) => r.re.test(p))

// A page whose whole job is to redirect: a link to it is a link to somewhere else.
function isRedirectOnly(file: string): boolean {
  const src = fs.readFileSync(file, 'utf8')
  return /(^|\n)\s*(permanentRedirect|redirect)\(/.test(src) && !/<[A-Za-z]/.test(src)
}

function configRedirects(): Set<string> {
  try {
    const cfg = require(path.join(ROOT, 'next.config.js'))
    const list = typeof cfg.redirects === 'function' ? cfg.redirects() : []
    return new Set((list as Array<{ source: string }>).map((r) => r.source).filter((s) => !/[:*()]/.test(s)))
  } catch {
    return new Set()
  }
}

const HREF = /href=(?:["']|\{["'`])(\/[^"'`$\s{}]*)["'`]|href:\s*["'`](\/[^"'`$\s{}]*)["'`]/g

function literalLinks(): Array<{ href: string; file: string }> {
  const dirs = ['app', 'components', 'lib'].map((d) => path.join(ROOT, d))
  const out: Array<{ href: string; file: string }> = []
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      if (!/\.(tsx|ts|jsx|js)$/.test(file)) continue
      const src = fs.readFileSync(file, 'utf8')
      for (const m of src.matchAll(HREF)) out.push({ href: m[1] ?? m[2], file: path.relative(ROOT, file) })
    }
  }
  return out
}

const pathOf = (href: string) => href.split(/[?#]/)[0] || '/'
const isFileLike = (p: string) => /\.[a-z0-9]{2,5}$/i.test(p)

describe('internal links', () => {
  const redirects = configRedirects()
  const links = literalLinks()

  it('finds routes and links to check', () => {
    expect(routes.length).toBeGreaterThan(50)
    expect(links.length).toBeGreaterThan(50)
  })

  it('can tell a redirect-only page from a real one (checked on pages we know)', () => {
    expect(isRedirectOnly(routeFor('/post-a-job')!.file)).toBe(true)
    expect(isRedirectOnly(routeFor('/about')!.file)).toBe(false)
    expect(routeFor('/job/some-title-j-abc12')).toBeDefined() // dynamic segments match
    expect(routeFor('/definitely/not/a/page')).toBeUndefined()
  })

  it('every literal internal link points at a page that exists', () => {
    const broken = links
      .map((l) => ({ ...l, p: pathOf(l.href) }))
      .filter(({ p }) => {
        if (isFileLike(p)) return !fs.existsSync(path.join(ROOT, 'public', p)) && !routeFor(p)
        return !routeFor(p)
      })
      .map(({ href, file }) => `${href}   (in ${file})`)
    expect([...new Set(broken)]).toEqual([])
  })

  it('no literal internal link points at a page that only redirects', () => {
    const redirecting = links
      .map((l) => ({ ...l, p: pathOf(l.href) }))
      .filter(({ p }) => {
        if (isFileLike(p)) return false
        const r = routeFor(p)
        return redirects.has(p) || (r !== undefined && isRedirectOnly(r.file))
      })
      .map(({ href, file }) => `${href}   (in ${file})`)
    expect([...new Set(redirecting)]).toEqual([])
  })
})

describe('footer', () => {
  const hrefs = FOOTER_COLUMNS.flatMap((c) => c.links.map(([, h]) => h))

  it('has no duplicate links and no empty columns', () => {
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const c of FOOTER_COLUMNS) expect(c.links.length).toBeGreaterThan(0)
  })

  it('links only to existing pages that are not redirects', () => {
    const bad = hrefs.filter((h) => {
      const p = pathOf(h)
      const r = routeFor(p)
      return !r || configRedirects().has(p) || isRedirectOnly(r.file)
    })
    expect(bad).toEqual([])
  })
})
