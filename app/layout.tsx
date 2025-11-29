import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Six Figure Jobs – $100k+ jobs only',
  description:
    'Six Figure Jobs curates only $100k+ jobs from top companies. Remote, hybrid, and on-site roles with real salary data.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full bg-slate-950">
      <body className="min-h-full bg-slate-950 text-slate-50">
        {children}
      </body>
    </html>
  )
}