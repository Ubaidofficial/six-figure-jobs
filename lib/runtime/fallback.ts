import type { Metadata } from 'next'
import { unstable_rethrow } from 'next/navigation'

import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'

type RuntimeFallbackMetadataOptions = {
  canonicalPath?: string
  title: string
  description: string
}

export function logRuntimeFallback(scope: string, error: unknown) {
  console.error(`[${scope}] fallback_used=1 reason=runtime_error`, error)
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
