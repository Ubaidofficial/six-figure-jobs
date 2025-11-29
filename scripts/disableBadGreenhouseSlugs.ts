// scripts/disableBadGreenhouseSlugs.ts
// One-off helper to clear ATS for known-bad Greenhouse slugs.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Fill this list with the bad Greenhouse slug pieces you saw 404-ing
const BAD_GREENHOUSE_SLUGS = [
  '1password',
  'adeptailabs',
  'character',
  'cohere',
  'color',
  'crowdstrike',
  'daboratoriesdbtlabs',
  'deel',
  'doordash',
  'hex',
  'himshers',
  'huggingface',
  'kclarna', // adjust if typo
  'linear',
  'mistral',
  // add others if you notice more 404s
]

async function main() {
  console.log('Disabling ATS for known-bad Greenhouse slugs...\n')

  const res = await prisma.company.updateMany({
    where: {
      atsProvider: 'greenhouse',
      atsUrl: {
        in: BAD_GREENHOUSE_SLUGS.map(
          (slug) => `https://boards.greenhouse.io/${slug}`,
        ),
      },
    },
    data: {
      atsProvider: null,
      atsUrl: null,
      scrapeStatus: 'disabled',
    },
  })

  console.log(`Updated ${res.count} companies`)
  await prisma.$disconnect()
}

if (require.main === module) {
  main().catch((err) => {
    console.error('💥 Script failed:', err)
    process.exit(1)
  })
}
