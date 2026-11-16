// lib/jobs/liveSiteStats.ts
//
// The numbers behind the "6figjobs today" band, read the way the homepage and the pricing page read them (same loaders, same
// rules), for the endpoint the band polls while a visitor is on the page. Each loader keeps its own short in-process cache
// (publicStats: 5 minutes; the screened-jobs figure: FREEHIRE_CATALOG_TTL_MS), so polling costs the database nothing extra.
import { loadFreehireCatalog } from './freehireCatalog'
import { loadLastRefreshedAt, loadPublicSiteStats } from './publicStats'
import type { LiveSiteStats } from './siteStatsShape'
import { loadSiteCounts } from './siteCounts'

/** The live numbers, or null when the job count cannot be read (the band then keeps what it shows). */
export async function loadLiveSiteStats(): Promise<LiveSiteStats | null> {
  try {
    const [site, counts, catalog, refreshedAt] = await Promise.all([
      loadPublicSiteStats(),
      loadSiteCounts().catch(() => null),
      loadFreehireCatalog().catch(() => null),
      loadLastRefreshedAt().catch(() => null),
    ])
    return {
      jobs: site.totalJobs,
      companies: site.totalCompaniesHiring,
      newThisWeek: site.newThisWeek,
      countries: counts ? counts.byCountry.filter((c) => c.count > 0).length || null : null,
      catalog,
      refreshedAt: refreshedAt ? refreshedAt.toISOString() : null,
    }
  } catch {
    return null
  }
}
