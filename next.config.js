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

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logo.clearbit.com' },
      { protocol: 'https', hostname: 'img.logo.dev' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'cdn.builtin.com' },
    ],
    // Enable optimisation for Core Web Vitals (WebP/AVIF conversion, responsive sizes).
    // Railway handles Node.js image processing fine; the previous unoptimized=true was
    // a conservative default that hurt LCP scores.
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    // Aggressive caching: Railway serves optimised images from the build cache.
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [
      ...sitemapSources.map((source) => ({ source, headers: sitemapCacheHeaders })),
      { source: '/robots.txt', headers: sitemapCacheHeaders },
      { source: '/search', headers: searchNoCacheHeaders },
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
