import './globals.css'
import type { Metadata } from 'next'
import type { Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'

import { ThemeProvider } from '@/components/theme-provider'
import { Footer } from '@/components/layout/Footer'
import { SiteHeader } from '@/components/layout/SiteHeader'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://www.6figjobs.com'
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: '$100k+ Jobs | High-Paying Six Figure Positions',
    template: '%s | Six Figure Jobs',
  },
  description:
    'Find 21,037+ verified jobs paying $100k+ USD (or local equivalent). Premium roles from 2,643 verified companies. Updated daily.',
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
    <html lang="en" suppressHydrationWarning className={`h-full ${spaceGrotesk.className}`}>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col">
            <SiteHeader />

            <div id="main-content" className="flex-1">
              {children}
            </div>

            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
