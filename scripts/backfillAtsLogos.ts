import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Get ATS companies without logos
  const companies = await prisma.company.findMany({
    where: { 
      atsUrl: { not: null },
      OR: [{ logoUrl: null }, { logoUrl: '' }]
    }
  })

  __slog(`Found ${companies.length} ATS companies without logos\n`)

  for (const c of companies) {
    // Extract domain from atsUrl or website
    let domain = ''
    
    if (c.website) {
      domain = c.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    } else if (c.atsUrl) {
      // Try to guess domain from company name
      const slug = c.name.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 30)
      domain = `${slug}.com`
    }

    if (domain) {
      const logoUrl = `https://logo.clearbit.com/${domain}`
      await prisma.company.update({
        where: { id: c.id },
        data: { logoUrl }
      })
      __slog(`✓ ${c.name} → ${logoUrl}`)
    } else {
      __slog(`✗ ${c.name} - no domain found`)
    }
  }

  __slog('\nDone!')
  await prisma.$disconnect()
}

main()
