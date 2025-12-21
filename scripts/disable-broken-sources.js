const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Disable sources with persistent errors
  const errorPatterns = [
    'ERR_NAME_NOT_RESOLVED',
    'ERR_CERT_',
    'ERR_CONNECTION_',
    'ERR_TIMED_OUT',
    'ERR_SSL_',
    'Execution context was destroyed',
    'TimeoutError'
  ]
  
  const result = await prisma.companySource.updateMany({
    where: {
      sourceType: 'generic_careers_page',
      scrapeStatus: 'error',
      OR: errorPatterns.map(pattern => ({
        scrapeError: { contains: pattern }
      }))
    },
    data: {
      isActive: false,
      scrapeError: 'Auto-disabled: persistent scraping error'
    }
  })

  console.log(`✅ Disabled ${result.count} broken sources`)
  
  // Stats
  const remaining = await prisma.companySource.count({
    where: {
      sourceType: 'generic_careers_page',
      isActive: true
    }
  })
  
  console.log(`📊 Active sources remaining: ${remaining}`)
}

main().finally(() => prisma.$disconnect())
