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

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


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
  __slog('🚀 Fixing missing company slugs…')

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'asc' },
  })

  __slog(`Loaded ${companies.length} companies…`)

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

  __slog(`✅ Updated ${updated} companies with slugs.`)
}

main()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
