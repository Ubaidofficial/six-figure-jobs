import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// US State codes
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']

async function main() {
  // Find jobs with US locations but no countryCode
  const jobs = await prisma.job.findMany({
    where: {
      countryCode: null,
      isExpired: false,
      OR: US_STATES.map(state => ({
        locationRaw: { contains: `, ${state}` }
      }))
    },
    select: { id: true, locationRaw: true }
  })

  console.log(`Found ${jobs.length} US jobs without countryCode`)

  // Update them
  const updated = await prisma.job.updateMany({
    where: {
      id: { in: jobs.map(j => j.id) }
    },
    data: { countryCode: 'US' }
  })

  console.log(`Updated ${updated.count} jobs to countryCode=US`)

  // Verify
  const sample = await prisma.job.findMany({
    where: { company: 'Anthropic', countryCode: 'US' },
    take: 3,
    select: { title: true, locationRaw: true, countryCode: true }
  })
  console.log('\nSample Anthropic US jobs:')
  sample.forEach(j => console.log(`  ${j.title} | ${j.locationRaw} | ${j.countryCode}`))

  await prisma.$disconnect()
}
main()
