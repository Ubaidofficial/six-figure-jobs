// app/blog/[slug]/page.tsx
// Individual blog post — Article + FAQPage + BreadcrumbList JSON-LD

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPostBySlug, getAllPosts } from '@/lib/blog/posts'
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'

export const revalidate = 86400

const SITE_URL = getSiteUrl()

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  const url = `${SITE_URL}/blog/${post.slug}`
  return {
    title: `${post.title} | ${SITE_NAME}`,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      siteName: SITE_NAME,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [`${SITE_URL}/og-image.png`],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const allPosts = getAllPosts().filter((p) => p.slug !== slug)
  const related = allPosts.filter((p) => p.category === post.category).slice(0, 3)
  const fallbackRelated = allPosts.slice(0, 3)
  const relatedPosts = related.length >= 2 ? related : fallbackRelated

  const postUrl = `${SITE_URL}/blog/${post.slug}`

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    url: postUrl,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: postUrl },
    ],
  }

  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ fontSize: 14, color: '#a3a3a3', marginBottom: 28, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/" style={{ color: '#a3a3a3', textDecoration: 'none' }}>Home</Link>
        <span>/</span>
        <Link href="/blog" style={{ color: '#a3a3a3', textDecoration: 'none' }}>Blog</Link>
        <span>/</span>
        <span style={{ color: '#fff' }}>{post.category}</span>
      </nav>

      {/* Article header */}
      <header style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#84cc16', background: '#84cc1618', border: '1px solid #84cc1640', borderRadius: 100, padding: '3px 10px' }}>
            {post.category}
          </span>
          <span style={{ fontSize: 13, color: '#555' }}>
            {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {' · '}
            {post.readingMinutes} min read
          </span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 16px', lineHeight: 1.2 }}>
          {post.title}
        </h1>
        <p style={{ fontSize: 18, color: '#a3a3a3', margin: 0, lineHeight: 1.6 }}>
          {post.excerpt}
        </p>
      </header>

      {/* Article body */}
      <article
        style={{ fontSize: 16, lineHeight: 1.8, color: '#d4d4d4' }}
        dangerouslySetInnerHTML={{ __html: styledContent(post.content) }}
      />

      {/* FAQ section */}
      {post.faq.length > 0 && (
        <section style={{ marginTop: 56 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Frequently asked questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {post.faq.map(({ q, a }) => (
              <div key={q} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '20px 24px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>{q}</h3>
                <p style={{ color: '#a3a3a3', margin: 0, lineHeight: 1.7, fontSize: 15 }}>{a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ marginTop: 48, background: '#0d1a0d', border: '1px solid #84cc1630', borderRadius: 16, padding: '32px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>
          Ready to find your <span style={{ color: '#84cc16' }}>six-figure job?</span>
        </h2>
        <p style={{ color: '#a3a3a3', margin: '0 0 20px', fontSize: 15 }}>
          Browse verified $100k+ positions with salaries published upfront. Apply directly — no recruiter middleman.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/jobs"
            style={{ background: '#84cc16', color: '#000', fontWeight: 700, fontSize: 15, padding: '10px 24px', borderRadius: 8, textDecoration: 'none' }}
          >
            Browse $100k+ Jobs
          </Link>
          <Link
            href="/salary"
            style={{ color: '#84cc16', fontWeight: 600, fontSize: 15, padding: '10px 24px', borderRadius: 8, border: '1px solid #84cc1640', textDecoration: 'none' }}
          >
            Salary Guides →
          </Link>
        </div>
      </section>

      {/* Related articles */}
      {relatedPosts.length > 0 && (
        <section style={{ marginTop: 56 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Related guides</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {relatedPosts.map((rel) => (
              <Link
                key={rel.slug}
                href={`/blog/${rel.slug}`}
                style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '16px 20px', textDecoration: 'none', display: 'block' }}
              >
                <div style={{ fontSize: 11, color: '#84cc16', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {rel.category}
                </div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{rel.title}</div>
                <div style={{ color: '#a3a3a3', fontSize: 13, marginTop: 4 }}>{rel.readingMinutes} min read</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

/**
 * Inject inline styles for article HTML elements since we're using inline style objects
 * and the content is raw HTML from the posts file.
 */
function styledContent(html: string): string {
  return html
    .replace(/<h2>/g, '<h2 style="font-size:22px;font-weight:700;margin:2em 0 0.5em;color:#fff">')
    .replace(/<h3>/g, '<h3 style="font-size:18px;font-weight:700;margin:1.5em 0 0.4em;color:#e5e5e5">')
    .replace(/<p>/g, '<p style="margin:0 0 1.2em;color:#c4c4c4;line-height:1.8">')
    .replace(/<ul>/g, '<ul style="margin:0 0 1.2em;padding-left:1.4em;color:#c4c4c4">')
    .replace(/<ol>/g, '<ol style="margin:0 0 1.2em;padding-left:1.4em;color:#c4c4c4">')
    .replace(/<li>/g, '<li style="margin-bottom:0.5em">')
    .replace(/<strong>/g, '<strong style="color:#fff;font-weight:700">')
    .replace(/<a href="/g, '<a style="color:#84cc16;text-decoration:none" href="')
}
