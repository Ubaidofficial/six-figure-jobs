/** @type {import('next').NextConfig} */
const sitemapCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400',
  },
]

const pageCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
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
    // Reduce Railway CPU/egress by skipping on-the-fly image optimization.
    unoptimized: true,
  },
  async headers() {
    return [
      { source: '/sitemap:rest*', headers: sitemapCacheHeaders },
      { source: '/robots.txt', headers: sitemapCacheHeaders },
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
