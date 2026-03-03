import { prisma } from '../lib/prisma'
import { buildWhere } from '../lib/jobs/queryJobs'

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

async function main() {
  const baseWhere = buildWhere({} as any)
  const categories = Object.keys(CATEGORY_ROLE_MAP)
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

  console.log(`[sitemap-category] MIN_INDEXABLE_JOBS=${MIN_INDEXABLE_JOBS}`)
  for (const cat of categories) {
    const slugs = (CATEGORY_ROLE_MAP[cat] || []).map((s) => s.toLowerCase())
    let total = 0
    for (const row of roleCounts) {
      if (slugs.some((slug) => row.slug === slug || row.slug.includes(slug))) {
        total += row.count
      }
    }

    const flag = total >= MIN_INDEXABLE_JOBS ? 'OK ' : '---'
    console.log(`[sitemap-category] ${flag} ${cat} total=${total}`)
  }
}

main().catch((err) => {
  console.error('[sitemap-category] error:', err)
  process.exitCode = 1
})
