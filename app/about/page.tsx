import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'

const SITE_URL = getSiteUrl()

export const metadata: Metadata = {
  title: `About ${SITE_NAME}`,
  description:
    'Six Figure Jobs is a curated job board for verified $100k+ roles across remote, hybrid, and on-site opportunities worldwide.',
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
  openGraph: {
    title: `About ${SITE_NAME}`,
    description:
      'Learn how Six Figure Jobs curates verified $100k+ roles, salary-first discovery pages, and direct-apply job listings.',
    url: `${SITE_URL}/about`,
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `About ${SITE_NAME}`,
    description:
      'Learn how Six Figure Jobs curates verified $100k+ roles, salary-first discovery pages, and direct-apply job listings.',
    images: [`${SITE_URL}/og-image.png`],
  },
}

export default function AboutPage() {
  const aboutPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${SITE_NAME}`,
    description:
      'Learn how Six Figure Jobs curates verified $100k+ roles, salary-first discovery pages, and direct-apply job listings.',
    url: `${SITE_URL}/about`,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    email: 'support@6figjobs.com',
    sameAs: [
      'https://linkedin.com/company/sixfigjobs',
      'https://twitter.com/6figjobs',
    ],
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'About', item: `${SITE_URL}/about` },
    ],
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        About Six Figure Jobs
      </h1>

      <p className="mt-5 text-base leading-7 text-slate-300">
        Six Figure Jobs helps job seekers find high-paying roles faster.
        We focus on verified <strong>$100k+</strong> roles with strong salary
        signals across <strong>remote</strong>, <strong>hybrid</strong>, and{' '}
        <strong>on-site</strong> work.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        What makes us different
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-slate-300">
        <li>
          <strong>Source-linked listings:</strong> we link to the original job
          post so you can apply direct.
        </li>
        <li>
          <strong>Salary-first discovery:</strong> browse by role, location, and
          pay bands.
        </li>
        <li>
          <strong>Global coverage:</strong> not just the US—EU and other regions
          are included when companies publish salary ranges.
        </li>
        <li>
          <strong>No index bloat:</strong> we avoid creating low-value pages that
          clutter search results.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">
        For job seekers
      </h2>
      <p className="mt-4 text-slate-300">
        Start here: <Link className="text-emerald-300 underline" href="/jobs">browse $100k+ jobs</Link>{' '}
        or explore <Link className="text-emerald-300 underline" href="/remote">remote roles</Link>.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-50">Contact</h2>
      <p className="mt-4 text-slate-300">
        For support or feedback, reach us at{' '}
        <a className="text-emerald-300 underline" href="mailto:support@6figjobs.com">
          support@6figjobs.com
        </a>
        .
      </p>

      <p className="mt-10 text-sm text-slate-500">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
    </main>
  )
}
