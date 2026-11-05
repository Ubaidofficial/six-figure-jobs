import type { Metadata } from 'next'
import { unstable_rethrow } from 'next/navigation'
import { connection } from 'next/server'

import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'

type RuntimeFallbackMetadataOptions = {
  canonicalPath?: string
  title: string
  description: string
}

export function logRuntimeFallback(scope: string, error: unknown) {
  console.error(`[${scope}] fallback_used=1 reason=runtime_error`, error)
}

/**
 * Call when a data load failed and a fallback is about to be rendered.
 *
 * During `next build` the database is unreachable (the Railway build container has no database access), so every
 * page that catches that error would otherwise prerender its "temporarily unavailable" fallback and serve it as
 * static HTML until the first revalidation, i.e. for several minutes after every deploy. While building, this
 * opts the page out of prerendering instead, so it is rendered on the first real request, when the database is
 * reachable. At runtime it does nothing: a genuine outage still renders the fallback.
 */
export async function skipPrerenderWhileBuilding(): Promise<void> {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    await connection()
  }
}

export async function withRuntimeFallback<T>(
  scope: string,
  loader: () => Promise<T>,
  fallback: (error: unknown) => T | Promise<T>,
): Promise<T> {
  try {
    return await loader()
  } catch (error) {
    unstable_rethrow(error)
    logRuntimeFallback(scope, error)
    await skipPrerenderWhileBuilding()
    return await fallback(error)
  }
}

export function buildRuntimeFallbackMetadata({
  canonicalPath,
  title,
  description,
}: RuntimeFallbackMetadataOptions): Metadata {
  const canonical = canonicalPath ? `${getSiteUrl()}${canonicalPath}` : undefined

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
