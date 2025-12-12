/** @type {import('next').NextConfig} */

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://6figjobs.com').replace(/\/+$/, '')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; img-src 'self' https: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:;",
  },
]

const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "logo.clearbit.com",
      },
      {
        protocol: "https",
        hostname: "remoteok.com",
      },
      {
        protocol: "https",
        hostname: "weworkremotely.com",
      },
      {
        protocol: "https",
        hostname: "lever-client-logos.s3.us-west-2.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "boards.greenhouse.io",
      },
      {
        protocol: "https",
        hostname: "prod.builtassets.com",
      },
      {
        protocol: "https",
        hostname: "ashbyhq.com",
      }
    ],
  },

  // Remove `experimental.serverActions: true`
  // Next.js 16 automatically handles server actions.
  experimental: {
    serverActions: {},
  },

  // Remove eslint key (not supported in config anymore)
  // Use .eslintrc.json instead.

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
