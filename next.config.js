/** @type {import('next').NextConfig} */
const sitemapCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400',
  },
]

const sitemapSources = [
  '/sitemap.xml',
  '/sitemap-jobs.xml',
  '/sitemap-company.xml',
  '/sitemap-city.xml',
  '/sitemap-remote.xml',
  '/sitemap-salary.xml',
  '/sitemap-country.xml',
  '/sitemap-category.xml',
  '/sitemap-level.xml',
  '/sitemap-browse.xml',
  '/sitemap-slices.xml',
  '/sitemap-jobs/:path*',
  '/sitemap-slices/:path*',
  '/sitemap-company/:path*',
  '/sitemap-city/:path*',
  '/sitemap-remote/:path*',
  '/sitemap-salary/:path*',
  '/sitemap-country/:path*',
  '/sitemap-category/:path*',
  '/sitemap-level/:path*',
  '/sitemap-browse/:path*',
  '/sitemap-blog.xml',
  '/sitemap-skills.xml',
]

const pageCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
  },
]

const searchNoCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'private, no-cache, no-store, max-age=0, must-revalidate',
  },
]

const salaryBandPattern = '(100k-plus|200k-plus|300k-plus|400k-plus)'
const countrySlugPattern =
  '(united-states|united-kingdom|canada|germany|australia|france|netherlands|sweden)'

const nextConfig = {
  // Keep SEO metadata in the initial <head> for crawlers and audit tools.
  // Next.js streams dynamic metadata for normal browsers, which makes tools
  // like Screaming Frog report title/canonical/robots tags outside <head>.
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logo.clearbit.com' },
      { protocol: 'https', hostname: 'img.logo.dev' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'cdn.builtin.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
    ],
    // unoptimized removed — Next.js image optimization now active (WebP/AVIF, resizing, CDN)
  },
  async redirects() {
    return [
      // 2-segment: bare country slug + salary band → location page
      {
        source: `/jobs/:country${countrySlugPattern}/:band${salaryBandPattern}`,
        destination: '/jobs/location/:country',
        permanent: true,
      },
      // 2-segment: "remote" as role slug → /remote hub
      {
        source: `/jobs/remote/:band${salaryBandPattern}`,
        destination: '/remote',
        permanent: true,
      },
      // 3-segment: role / "remote" / band → /remote/role (must come before generic 3-seg rule)
      {
        source: `/jobs/:role/remote/:band${salaryBandPattern}`,
        destination: '/remote/:role',
        permanent: true,
      },
      // 3-segment: role / any-country-or-null / band → role/band (catches all stale 3-seg URLs)
      // Handles: /jobs/software-engineer/united-states/100k-plus,
      //          /jobs/senior-pm/singapore/100k-plus, /jobs/engineer/null/100k-plus, etc.
      {
        source: `/jobs/:role/:country/:band${salaryBandPattern}`,
        destination: '/jobs/:role/:band',
        permanent: true,
      },
      // Strip ?seniority query param — canonical role pages have no seniority filter in URL
      {
        source: '/jobs/:role',
        has: [{ type: 'query', key: 'seniority' }],
        destination: '/jobs/:role',
        permanent: true,
      },
      // Strip ?skill query param combos (e.g. /jobs/other?skill=react&seniority=staff)
      {
        source: '/jobs/:role',
        has: [{ type: 'query', key: 'skill' }],
        destination: '/jobs/:role',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      ...sitemapSources.map((source) => ({ source, headers: sitemapCacheHeaders })),
      { source: '/robots.txt', headers: sitemapCacheHeaders },
      {
        source: '/search',
        headers: [
          ...searchNoCacheHeaders,
          { key: 'X-Robots-Tag', value: 'noindex, follow' },
        ],
      },
      { source: '/job/:path*', headers: pageCacheHeaders },
      { source: '/remote/:path*', headers: pageCacheHeaders },
      { source: '/jobs/:path*', headers: pageCacheHeaders },
      { source: '/company/:path*', headers: pageCacheHeaders },
      { source: '/companies/:path*', headers: pageCacheHeaders },
      { source: '/salary/:path*', headers: pageCacheHeaders },
      { source: '/country/:path*', headers: pageCacheHeaders },
      { source: '/city/:path*', headers: pageCacheHeaders },
      { source: '/role/:path*', headers: pageCacheHeaders },
    ]
  },
}

module.exports = nextConfig
