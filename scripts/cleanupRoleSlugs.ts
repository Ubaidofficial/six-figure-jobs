// scripts/cleanupRoleSlugs.ts
// Run with: npx tsx scripts/cleanupRoleSlugs.ts

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { isCanonicalSlug } from '../lib/roles/canonicalSlugs'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

// Simplified role inference for cleanup (reuses logic from ingestFromAts)
function inferRoleFromTitle(title: string): string | null {
  const t = ` ${title.toLowerCase()} `

  // Quick pattern matching - add more as needed
  if (t.includes('software engineer') || t.includes('software developer')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-software-engineer'
    if (t.includes(' staff ')) return 'staff-software-engineer'
    return 'software-engineer'
  }
  if (t.includes('product manager')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-product-manager'
    return 'product-manager'
  }
  if (t.includes('data scientist')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-data-scientist'
    return 'data-scientist'
  }
  if (t.includes('data engineer')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-data-engineer'
    return 'data-engineer'
  }
  if (t.includes('frontend') || t.includes('front-end')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-frontend-engineer'
    return 'frontend-engineer'
  }
  if (t.includes('backend') || t.includes('back-end')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-backend-engineer'
    return 'backend-engineer'
  }
  if (t.includes('full stack') || t.includes('fullstack')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-full-stack-engineer'
    return 'full-stack-engineer'
  }
  if (t.includes('devops')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-devops-engineer'
    return 'devops-engineer'
  }
  if (t.includes('machine learning') || t.includes(' ml ')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-machine-learning-engineer'
    return 'machine-learning-engineer'
  }
  if (t.includes('ux designer')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-ux-designer'
    return 'ux-designer'
  }
  if (t.includes('product designer')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-product-designer'
    return 'product-designer'
  }
  if (t.includes('engineering manager')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-engineering-manager'
    return 'engineering-manager'
  }
  if (t.includes('account executive')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-account-executive'
    return 'account-executive'
  }
  if (t.includes('qa engineer')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-qa-engineer'
    return 'qa-engineer'
  }

  // Generic engineer catch-all
  if (t.includes(' engineer ') && !t.includes(' manager ')) {
    if (t.includes(' senior ') || t.includes(' sr ')) return 'senior-software-engineer'
    return 'software-engineer'
  }

  return null
}

async function cleanupRoleSlugs() {
  __slog('🔧 Starting role slug cleanup...\n')

  const jobs = await prisma.job.findMany({
    where: {
      roleSlug: { not: null },
    },
    select: {
      id: true,
      title: true,
      roleSlug: true,
    },
  })

  __slog(`Found ${jobs.length} jobs with role slugs\n`)

  let alreadyValid = 0
  let fixed = 0
  let nulled = 0
  const invalidSlugs = new Map<string, number>()

  for (const job of jobs) {
    if (!job.roleSlug) continue

    if (isCanonicalSlug(job.roleSlug)) {
      alreadyValid++
      continue
    }

    invalidSlugs.set(job.roleSlug, (invalidSlugs.get(job.roleSlug) || 0) + 1)

    const newSlug = inferRoleFromTitle(job.title)

    if (newSlug && isCanonicalSlug(newSlug)) {
      await prisma.job.update({
        where: { id: job.id },
        data: { roleSlug: newSlug },
      })
      fixed++
    } else {
      await prisma.job.update({
        where: { id: job.id },
        data: { roleSlug: null },
      })
      nulled++
    }
  }

  __slog('\n════════════════════════════════════════')
  __slog('           CLEANUP SUMMARY')
  __slog('════════════════════════════════════════\n')
  __slog(`✅ Already valid:  ${alreadyValid}`)
  __slog(`🔧 Fixed:          ${fixed}`)
  __slog(`⚠️  Set to null:    ${nulled}`)
  __slog(`📊 Total processed: ${jobs.length}`)

  if (invalidSlugs.size > 0) {
    __slog('\n📋 Top 20 invalid slugs found:')
    const sorted = [...invalidSlugs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
    for (const [slug, count] of sorted) {
      __slog(`   ${count.toString().padStart(4)} × ${slug}`)
    }
  }

  __slog('\n✨ Cleanup complete!')
}

cleanupRoleSlugs()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

