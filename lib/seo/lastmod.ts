// lib/seo/lastmod.ts
//
// How a sitemap states "this page last changed". Rules (sitemaps.org and Google's guidance: a date that is not the real
// last change teaches Google to ignore the field):
//   - a day (YYYY-MM-DD, UTC), not a time to the millisecond: we know on which day jobs were added, and a time that moves
//     with every hourly sync reads as a build stamp;
//   - never the time of the request: no date is better than an invented one;
//   - never a date in the future.

/** "2026-11-16" for a date (or ISO string), or null when it is missing, invalid or in the future. */
export function sitemapDate(value: Date | string | null | undefined, now: Date = new Date()): string | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime() + 60_000) return null
  return d.toISOString().slice(0, 10)
}

/** The newest `<lastmod>` in a urlset (as dates), or null when it has none. Used to date a sitemap by its own entries. */
export function newestLastmod(xml: string): string | null {
  let newest: string | null = null
  for (const m of xml.matchAll(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/g)) {
    const day = sitemapDate(m[1])
    if (day && (!newest || day > newest)) newest = day
  }
  return newest
}
