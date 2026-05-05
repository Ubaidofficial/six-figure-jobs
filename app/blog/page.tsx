// app/blog/page.tsx
// Editorial content hub — informational articles targeting top-of-funnel queries
// adjacent to six-figure job listings.

import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPosts } from '@/lib/blog/posts'
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'

export const revalidate = 86400

const SITE_URL = getSiteUrl()

export const metadata: Metadata = {
  title: `Career Guides & Salary Insights | ${SITE_NAME}`,
  description:
    'Expert guides on six-figure salaries, tech career paths, visa sponsorship, remote work, and salary negotiation. Real data from live $100k+ job listings.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: `Career Guides & Salary Insights | ${SITE_NAME}`,
    description: 'Expert guides on six-figure salaries, tech career paths, and salary negotiation.',
    url: `${SITE_URL}/blog`,
    siteName: SITE_NAME,
    type: 'website',
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  'Salary Guides':    '#84cc16',
  'Career Advice':    '#60a5fa',
  'Remote Work':      '#a78bfa',
  'Visa & Immigration': '#f59e0b',
}

export default function BlogIndexPage() {
  const posts = getAllPosts()

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
    ],
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ fontSize: 14, color: '#a3a3a3', marginBottom: 24, display: 'flex', gap: 8 }}>
        <Link href="/" style={{ color: '#a3a3a3', textDecoration: 'none' }}>Home</Link>
        <span>/</span>
        <span style={{ color: '#fff' }}>Blog</span>
      </nav>

      {/* Header */}
      <header style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 38, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.2 }}>
          Career Guides &amp; <span style={{ color: '#84cc16' }}>Salary Insights</span>
        </h1>
        <p style={{ fontSize: 17, color: '#a3a3a3', margin: 0, maxWidth: 600 }}>
          Expert guides on six-figure tech salaries, career paths, visa sponsorship, and salary negotiation —
          backed by live data from {posts.length > 0 ? 'real' : ''} $100k+ job listings.
        </p>
      </header>

      {/* Post grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {posts.map((post) => {
          const color = CATEGORY_COLORS[post.category] || '#84cc16'
          return (
            <article
              key={post.slug}
              style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 14, padding: '24px 28px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color,
                    background: `${color}18`,
                    border: `1px solid ${color}40`,
                    borderRadius: 100,
                    padding: '3px 10px',
                  }}
                >
                  {post.category}
                </span>
                <span style={{ fontSize: 13, color: '#555' }}>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  {post.readingMinutes} min read
                </span>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.3 }}>
                <Link
                  href={`/blog/${post.slug}`}
                  style={{ color: '#fff', textDecoration: 'none' }}
                >
                  {post.title}
                </Link>
              </h2>
              <p style={{ color: '#a3a3a3', fontSize: 15, margin: '0 0 16px', lineHeight: 1.6 }}>
                {post.excerpt}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                style={{ color, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
              >
                Read guide →
              </Link>
            </article>
          )
        })}
      </div>

      {/* Related searches */}
      <section style={{ marginTop: 56 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Browse jobs by category</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { href: '/jobs/software-engineer', label: 'Software Engineer Jobs' },
            { href: '/remote', label: 'Remote $100k+ Jobs' },
            { href: '/jobs/200k-plus', label: '$200k+ Jobs' },
            { href: '/jobs/visa-sponsorship', label: 'Visa Sponsorship Jobs' },
            { href: '/jobs/no-degree', label: 'No-Degree Tech Jobs' },
            { href: '/salary', label: 'All Salary Guides' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{ color: '#84cc16', fontSize: 13, textDecoration: 'none', border: '1px solid #84cc1640', borderRadius: 8, padding: '6px 14px' }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
