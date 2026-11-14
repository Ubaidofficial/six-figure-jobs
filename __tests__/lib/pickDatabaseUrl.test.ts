import { pickDatabaseUrl } from '../../lib/prisma'

const urls = { DATABASE_URL: 'postgresql://app@db-a/x', POSTGRES_PRISMA_URL: 'postgresql://app@db-b/x', BUILD_DATABASE_URL: 'postgresql://app@public:5433/x' }

// The builder cannot reach the private database address; without a database at build time the homepage became a page
// rendered on every request (2026-11-14). BUILD_DATABASE_URL is used only while `next build` runs.
describe('pickDatabaseUrl', () => {
  it('uses BUILD_DATABASE_URL only during the production build', () => {
    expect(pickDatabaseUrl({ ...urls, NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })).toBe(urls.BUILD_DATABASE_URL)
    expect(pickDatabaseUrl({ ...urls, NODE_ENV: 'production', NEXT_PHASE: 'phase-production-server' })).toBe(urls.POSTGRES_PRISMA_URL)
    expect(pickDatabaseUrl({ ...urls, NODE_ENV: 'production' })).toBe(urls.POSTGRES_PRISMA_URL)
  })

  it('keeps the old order when BUILD_DATABASE_URL is unset or blank', () => {
    const { BUILD_DATABASE_URL: _unused, ...rest } = urls
    expect(pickDatabaseUrl({ ...rest, NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })).toBe(urls.POSTGRES_PRISMA_URL)
    expect(pickDatabaseUrl({ ...urls, BUILD_DATABASE_URL: '  ', NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })).toBe(urls.POSTGRES_PRISMA_URL)
    expect(pickDatabaseUrl({ ...urls, NODE_ENV: 'development' })).toBe(urls.DATABASE_URL)
    expect(pickDatabaseUrl({ ...urls, NODE_ENV: 'production', PRISMA_PREFER_DATABASE_URL: '1' })).toBe(urls.DATABASE_URL)
  })
})
