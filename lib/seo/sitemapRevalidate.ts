import 'dotenv/config'

/**
 * Triggers an on-demand revalidation of the sitemap indexes and shards.
 * Used primarily by the scraper pipeline when jobs expire/are deleted,
 * solving the mid-cache race condition where a sitemap contains 404ing URLs.
 */
export async function triggerSitemapRevalidation(): Promise<void> {
  const secret = process.env.REVALIDATION_SECRET
  if (!secret) {
    console.warn('[SitemapRevalidate] No REVALIDATION_SECRET configured, skipping.')
    return
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.6figjobs.com'

  try {
    const res = await fetch(`${siteUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // We purge the known entrypoints. sitemap.xml cache is purged,
        // and sitemap-jobs.xml and chunk 1 are explicitly purged.
        paths: ['/sitemap.xml', '/sitemap-jobs.xml', '/sitemap-jobs/1'],
      }),
    })

    if (!res.ok) {
      console.error(
        `[SitemapRevalidate] Webhook returned ${res.status}:`,
        await res.text()
      )
    } else {
      console.log('[SitemapRevalidate] Successfully triggered sitemap revalidation.')
    }
  } catch (error) {
    console.error('[SitemapRevalidate] Failed to fetch webhook:', error)
  }
}
