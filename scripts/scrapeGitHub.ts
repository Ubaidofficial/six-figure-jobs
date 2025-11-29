import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function slugify(name: string): string {
  return name.toLowerCase().replace(/&/g, '-and-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function main() {
  console.log('Fetching GitHub remoteintech/remote-jobs list...\n')
  
  const res = await fetch('https://raw.githubusercontent.com/remoteintech/remote-jobs/main/README.md')
  const text = await res.text()
  
  const companies: string[] = []
  const lines = text.split('\n')
  
  for (const line of lines) {
    // Match: [Company Name](/company-profiles/...) | https://...
    // Format: [10up](/company-profiles/10up.md) | https://10up.com/ | Worldwide
    const match = line.match(/^\[([^\]]+)\]\(\/company-profiles\//)
    if (match && match[1]) {
      const name = match[1].trim()
      if (name.length > 1 && name.length < 100) {
        companies.push(name)
      }
    }
  }
  
  console.log('Found', companies.length, 'companies in GitHub list')
  console.log('Sample:', companies.slice(0, 10).join(', '))
  
  let added = 0, existed = 0
  
  for (const name of companies) {
    const slug = slugify(name)
    if (!slug || slug.length < 2) continue
    
    const existing = await prisma.company.findFirst({
      where: { OR: [{ slug }, { name }] }
    })
    
    if (existing) { existed++; continue }
    
    await prisma.company.create({
      data: { name, slug, logoUrl: 'https://logo.clearbit.com/' + slug.replace(/-/g, '') + '.com' }
    })
    added++
  }
  
  const total = await prisma.company.count()
  console.log('\nExisted:', existed, '| Added:', added, '| Total:', total)
  await prisma.$disconnect()
}

main()
