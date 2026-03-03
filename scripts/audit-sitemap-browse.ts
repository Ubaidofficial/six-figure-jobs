import { getSiteUrl } from '@/lib/seo/site'
import { buildBrowseSitemapReport } from '@/lib/seo/browseSitemap'

async function main() {
  const report = await buildBrowseSitemapReport(3)

  const siteUrl = getSiteUrl()
  const included = report.included
  const excluded = report.excluded

  console.log('[sitemap-browse] minJobs=%d candidates=%d', report.minJobs, report.candidates)
  console.log('[sitemap-browse] included=%d excluded=%d', included.length, excluded.length)

  console.log('\nTop excluded (first 30):')
  for (const row of excluded.slice(0, 30)) {
    console.log(' - %s total=%d reason=%s', row.path, row.total, row.reason ?? 'unknown')
  }

  console.log('\nSample included URLs (first 10):')
  for (const row of included.slice(0, 10)) {
    console.log(' - %s%s total=%d', siteUrl, row.path, row.total)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

