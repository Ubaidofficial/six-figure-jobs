import './globals.css'
import type { Metadata } from 'next'
import type { Viewport } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'

import { Footer } from '@/components/layout/Footer'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import ErrorTracker from '@/components/ErrorTracker'
import { getSiteUrl } from '../lib/seo/site'
import { PreloadResources } from './preload-resources'

const SITE_URL = getSiteUrl()

// Self-hosted variable fonts (Latin subset): no third-party request, and next/font generates size-adjusted
// fallbacks so swapping in the web font does not shift the layout.
const bodyFont = localFont({
  src: './fonts/InstrumentSans.woff2',
  variable: '--font-instrument',
  weight: '400 700',
  display: 'swap',
})
const displayFont = localFont({
  src: './fonts/BricolageGrotesque.woff2',
  variable: '--font-bricolage',
  weight: '200 800',
  display: 'swap',
})
// Outfit ExtraBold is used only for the "six fig jobs" wordmark; it is preloaded because the logo is above the fold.
const logoFont = localFont({
  src: './fonts/Outfit.woff2',
  variable: '--font-logo',
  weight: '100 900',
  display: 'swap',
})
const monoFont = localFont({
  src: './fonts/JetBrainsMono.woff2',
  variable: '--font-jetbrains',
  weight: '400 800',
  display: 'swap',
  preload: false, // only salary figures use it; fetched when first needed
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '$100k+ Jobs | High-Paying Six Figure Positions',
    template: '%s',
  },
  description:
    'Find $100k+ jobs with clear salary ranges and trusted employers. Premium roles across engineering, product, data, and design.',
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
        alt: 'Six Figure Jobs: jobs that pay $100k+',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@6figjobs',
    images: [`${SITE_URL}/og-image.png`],
  },
  // Icons come from the file conventions in app/: icon.svg, favicon.ico and apple-icon.png.
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Light only: no dark theme. colorScheme keeps native form controls and scrollbars light too.
  colorScheme: 'light',
  themeColor: '#f7f7f4',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`light h-full ${bodyFont.variable} ${displayFont.variable} ${logoFont.variable} ${monoFont.variable}`}
    >
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
        {/* Microsoft Clarity (project zagoogkx9a) */}
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "zagoogkx9a");`}
        </Script>
      </body>
    </html>
  )
}
