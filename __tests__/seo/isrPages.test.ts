import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// A dynamic route ([skill], [level], [city]) without generateStaticParams is rendered on every request and its `revalidate` does
// nothing: measured 2026-11-20 in production, 2-6 s to first byte on every request for these pages, and in a local build they
// carried no x-nextjs-cache header and caused database queries on every request. With an empty generateStaticParams they are
// cached on first request (x-nextjs-cache MISS, then HIT, no queries) and refreshed in the background every `revalidate` seconds.
// Reading `searchParams` in the page brings the per-request rendering back, so these pages must not.
const PAGES = [
  'app/jobs/skills/[skill]/page.tsx',
  'app/jobs/skills/[skill]/remote/page.tsx',
  'app/jobs/level/[level]/page.tsx',
  'app/jobs/city/[city]/page.tsx',
  'app/jobs/[role]/skills/[skill]/page.tsx',
]

describe.each(PAGES)('%s', (file) => {
  const source = readFileSync(join(__dirname, '../..', file), 'utf8')

  it('can be cached: it exports generateStaticParams and a revalidate time', () => {
    expect(source).toMatch(/export async function generateStaticParams\(\)/)
    expect(source).toMatch(/export const revalidate = \d+/)
  })

  it('builds nothing at deploy time (an empty list), so a build that cannot reach the database still succeeds', () => {
    expect(source).toMatch(/generateStaticParams\(\)[^{]*\{\s*return \[\]\s*\}/)
  })

  it('does not read searchParams, which would make every request render again', () => {
    expect(source).not.toMatch(/searchParams/)
  })
})
