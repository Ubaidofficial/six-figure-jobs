import './globals.css'
import type { Metadata } from 'next'
import type { Viewport } from 'next'

import { Footer } from '@/components/layout/Footer'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { getSiteUrl } from '../lib/seo/site'

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: '$100k+ Jobs | High-Paying Six Figure Positions',
    template: '%s',
  },
  description:
    'Find verified $100k+ jobs with clear salary ranges and trusted employers. Premium roles across engineering, product, data, and design. Updated daily.',
  robots: process.env.NEXT_PUBLIC_SITE_URL?.includes('staging')
    ? { index: false, follow: false }
    : undefined,
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
        <div className="flex min-h-screen flex-col">
          <SiteHeader />

          <div id="main-content" className="flex-1">
            {children}
          </div>

          <Footer />
        </div>
      </body>
    </html>
  )
}
