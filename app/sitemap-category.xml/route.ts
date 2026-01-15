import { prisma } from '../../lib/prisma'
import { buildWhere } from '../../lib/jobs/queryJobs'

const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://www.6figjobs.com'

export async function GET() {
  const MIN_INDEXABLE_JOBS = 3
  const CATEGORY_ROLE_MAP: Record<string, string[]> = {
    engineering: [
      'software-engineer',
      'backend',
      'frontend',
      'full-stack',
      'mobile',
      'ios',
      'android',
      'platform',
      'systems',
      'application',
      'devops',
      'sre',
      'infrastructure',
      'web-developer',
    ],
    product: ['product-manager', 'product-owner', 'product'],
    data: ['data-scientist', 'data-engineer', 'analytics', 'data-analyst'],
    design: ['designer', 'design', 'ux', 'ui', 'product-designer'],
    devops: ['devops', 'sre', 'site-reliability'],
    mlai: ['machine-learning', 'ml', 'ai', 'artificial-intelligence'],
    sales: ['sales', 'account-executive', 'sdr', 'bdr'],
    marketing: ['marketing', 'growth', 'demand-generation', 'seo', 'performance'],
  }
  const categories = Object.keys(CATEGORY_ROLE_MAP)

  const baseWhere = buildWhere({})
  const roleRows = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: { ...baseWhere, roleSlug: { not: null } },
    _count: { _all: true },
  })

  const roleCounts = roleRows
    .map((row) => ({
      slug: row.roleSlug ? String(row.roleSlug).toLowerCase() : '',
      count: Number(row._count?._all ?? 0),
    }))
    .filter((row) => row.slug)

  const urls = categories
    .map((cat) => {
      const slugs = (CATEGORY_ROLE_MAP[cat] || []).map((s) => s.toLowerCase())
      let total = 0
      for (const row of roleCounts) {
        if (slugs.some((slug) => row.slug === slug || row.slug.includes(slug))) {
          total += row.count
        }
      }
      if (total < MIN_INDEXABLE_JOBS) return null
      return {
        url: `${SITE_URL}/jobs/category/${cat}`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'daily',
        priority: 0.8,
      }
    })
    .filter(Boolean) as Array<{
      url: string
      lastModified: string
      changeFrequency: string
      priority: number
    }>

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.url}</loc>
    <lastmod>${u.lastModified}</lastmod>
    <changefreq>${u.changeFrequency}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
