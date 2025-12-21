const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sources = await prisma.companySource.findMany({
    where: {
      sourceType: 'generic_careers_page',
      isActive: true
    },
    include: { company: true }
  })

  console.log('Generic sources configured:', sources.length)
  console.log('\nActive sources:')
  sources.forEach((s, i) => {
    console.log(`${i + 1}. ${s.company.name} - ${s.url}`)
    if (s.scrapeStatus) console.log(`   Status: ${s.scrapeStatus}`)
    if (s.scrapeError) console.log(`   Error: ${s.scrapeError}`)
  })

  const errorSources = sources.filter(s => s.scrapeStatus === 'error')
  console.log(`\n❌ Sources with errors: ${errorSources.length}`)
  
  if (errorSources.length > 0) {
    console.log('\nFailed sources:')
    errorSources.forEach(s => {
      console.log(`- ${s.company.name}: ${s.scrapeError || 'unknown'}`)
    })
  }
}

main().finally(() => prisma.$disconnect())
