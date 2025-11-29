/** @type {import('next').NextConfig} */

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
    ]
  },
}

module.exports = nextConfig
