// scripts/rebuildRoleSlugs.ts

/**
 * Rebuilds roleSlug for jobs that are missing it.
 *
 * Run with:
 *   npx ts-node scripts/rebuildRoleSlugs.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferRoleSlug(title: string): string {
  const t = title.toLowerCase()

  // Order matters: more specific first
  if (t.includes('data scientist')) return 'data-scientist'
  if (t.includes('ml engineer') || t.includes('machine learning engineer'))
    return 'ml-engineer'
  if (t.includes('ai engineer')) return 'ai-engineer'
  if (t.includes('machine learning')) return 'machine-learning'
  if (t.includes('devops')) return 'devops-engineer'
  if (t.includes('frontend') || t.includes('front-end'))
    return 'frontend-engineer'
  if (t.includes('backend') || t.includes('back-end'))
    return 'backend-engineer'
  if (t.includes('fullstack') || t.includes('full-stack'))
    return 'fullstack-engineer'
  if (t.includes('software engineer') || t.includes('software developer'))
    return 'software-engineer'
  if (t.includes('product manager')) return 'product-manager'
  if (t.includes('designer')) return 'designer'
  if (t.includes('data engineer')) return 'data-engineer'
  if (t.includes('analyst')) return 'analyst'
  if (t.includes('sre') || t.includes('site reliability'))
    return 'site-reliability-engineer'

  // Fallback: slugify the title itself
  return slugify(title)
}

async function main() {
  console.log('🚀 Rebuilding role slugs…')

  const jobs = await prisma.job.findMany({
    where: {
      OR: [{ roleSlug: null }, { roleSlug: '' }],
      isExpired: false,
    },
    select: { id: true, title: true },
  })

  console.log(`Found ${jobs.length} jobs missing roleSlug…`)

  let updated = 0

  for (const job of jobs) {
    if (!job.title) continue
    const roleSlug = inferRoleSlug(job.title)

    await prisma.job.update({
      where: { id: job.id },
      data: { roleSlug },
    })
    updated++
  }

  console.log(`✅ Updated ${updated} role slugs.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
