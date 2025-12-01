// scripts/backfillCompanyProfiles.ts
// Enrich companies missing description/linkedin/logo from a CSV or basic heuristics.
// Usage:
//   npx tsx scripts/backfillCompanyProfiles.ts companies.csv
//
// CSV columns (header optional): name,website,linkedin,description,logo

import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'

type CompanyInput = {
  name: string
  website?: string | null
  linkedin?: string | null
  description?: string | null
  logo?: string | null
}

function parseCsv(filePath: string): CompanyInput[] {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const lines = raw.split(/\r?\n/).filter(Boolean)
  const items: CompanyInput[] = []

  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim())
    if (parts.length < 1) continue
    const [name, website, linkedin, description, logo] = parts
    if (!name) continue
    items.push({
      name,
      website: website || null,
      linkedin: linkedin || null,
      description: description || null,
      logo: logo || null,
    })
  }
  return items
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: npx tsx scripts/backfillCompanyProfiles.ts companies.csv')
    process.exit(1)
  }

  const filePath = path.resolve(process.cwd(), file)
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const companies = parseCsv(filePath)
  console.log(`Parsed ${companies.length} rows from CSV`)

  let updated = 0

  for (const c of companies) {
    const existing = await prisma.company.findFirst({
      where: { name: c.name },
    })

    if (!existing) continue

    const data: any = {}
    if (c.website && !existing.website) data.website = c.website
    if (c.linkedin && !(existing as any).linkedinUrl) data.linkedinUrl = c.linkedin
    if (c.logo && !existing.logoUrl) data.logoUrl = c.logo
    if (c.description && !existing.description) data.description = c.description

    if (Object.keys(data).length === 0) continue

    await prisma.company.update({
      where: { id: existing.id },
      data,
    })
    updated++
  }

  console.log(`Updated ${updated} companies with profile data.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
