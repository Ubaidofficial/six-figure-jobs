import './globals.css'
import type { Metadata } from 'next'
import type { Viewport } from 'next'

import { Footer } from '@/components/layout/Footer'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import ErrorTracker from '@/components/ErrorTracker'
import { getSiteUrl } from '../lib/seo/site'
import { PreloadResources } from './preload-resources'

const SITE_URL = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '$100k+ Jobs | High-Paying Six Figure Positions',
    template: '%s',
  },
  description:
    'Find verified $100k+ jobs with clear salary ranges and trusted employers. Premium roles across engineering, product, data, and design. Updated daily.',
  robots: process.env.NEXT_PUBLIC_SITE_URL?.includes('staging')
    ? { index: false, follow: false }
    : undefined,
  // NOTE: No global canonical here — each page sets its own via generateMetadata.
  // A global canonical pointing to the homepage would create canonical conflicts at scale.
  // Default OG image for pages that don't have a dynamic opengraph-image.tsx
  openGraph: {
    siteName: 'Six Figure Jobs',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Six Figure Jobs — $100k+ verified roles',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@6figjobs',
    images: [`${SITE_URL}/og-image.png`],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/logo.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: { url: '/logo.png', sizes: '512x512' },
    shortcut: '/logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="min-h-full bg-background text-foreground">
        <PreloadResources />
        <div className="flex min-h-screen flex-col">
          <SiteHeader />

          <div id="main-content" className="flex-1">
            {children}
          </div>

          <Footer />
        </div>
        <FeedbackWidget />
        <ErrorTracker />
      </body>
    </html>
  )
}
