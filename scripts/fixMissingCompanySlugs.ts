// scripts/fixMissingCompanySlugs.ts

/**
 * Ensures every company has a usable, unique slug.
 *
 * Rules:
 *  - If slug is null/empty, generate from name.
 *  - Ensure uniqueness by appending "-2", "-3", etc if needed.
 *
 * Run with:
 *   npx ts-node scripts/fixMissingCompanySlugs.ts
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

async function ensureUniqueSlug(base: string, existing: Set<string>) {
  let slug = base || 'company'
  let suffix = 2

  while (existing.has(slug)) {
    slug = `${base}-${suffix}`
    suffix++
  }

  existing.add(slug)
  return slug
}

async function main() {
  console.log('🚀 Fixing missing company slugs…')

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Loaded ${companies.length} companies…`)

  const existingSlugs = new Set<string>()
  for (const c of companies) {
    if (c.slug) existingSlugs.add(c.slug)
  }

  let updated = 0

  for (const company of companies) {
    // Needs slug?
    if (company.slug && company.slug.trim() !== '') continue

    const base =
      company.name && company.name.trim() !== ''
        ? slugify(company.name)
        : 'company'

    const uniqueSlug = await ensureUniqueSlug(base, existingSlugs)

    await prisma.company.update({
      where: { id: company.id },
      data: { slug: uniqueSlug },
    })

    updated++
  }

  console.log(`✅ Updated ${updated} companies with slugs.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
