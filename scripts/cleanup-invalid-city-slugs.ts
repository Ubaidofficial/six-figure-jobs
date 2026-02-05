import { prisma } from '../lib/prisma'

const INVALID_CITY_SLUGS = [
  'remote',
  'anywhere',
  'anywhere-in-the-world',
  'anywhere-in-world',
  'worldwide',
  'global',
  'world',
  'europe',
  'emea',
  'apac',
  'latam',
  'americas',
  'north-america',
  'south-america',
  'asia',
  'asia-pacific',
  'middle-east',
  'africa',
  'us',
  'usa',
  'uk',
  'united-states',
  'united-kingdom',
  'canada',
  'germany',
  'france',
  'spain',
  'italy',
  'australia',
  'new-zealand',
  'india',
  'singapore',
]

async function main() {
  const before = await prisma.job.count({
    where: { citySlug: { in: INVALID_CITY_SLUGS } },
  })

  const result = await prisma.job.updateMany({
    where: { citySlug: { in: INVALID_CITY_SLUGS } },
    data: { city: null, citySlug: null },
  })

  console.log(`[cleanup-city-slugs] invalid slugs=${before} updated=${result.count}`)
}

main()
  .catch((err) => {
    console.error('[cleanup-city-slugs] error:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
