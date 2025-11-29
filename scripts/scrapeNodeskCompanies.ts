import puppeteer from 'puppeteer'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugify(name: string): string {
  return name.toLowerCase().replace(/&/g, '-and-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function main() {
  console.log('Scraping Nodesk remote companies...')
  
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  
  await page.goto('https://nodesk.co/remote-companies/', {
    waitUntil: 'networkidle2',
    timeout: 30000
  })
  
  await new Promise(r => setTimeout(r, 3000))
  
  const companies = await page.evaluate(() => {
    const results: { name: string; slug: string }[] = []
    const seen = new Set()
    
    document.querySelectorAll('a').forEach(link => {
      const href = link.getAttribute('href') || ''
      if (!href.includes('/remote-companies/')) return
      
      const slug = href.replace(/\/$/, '').split('/').pop() || ''
      if (!slug || slug === 'remote-companies' || slug.length < 3) return
      if (href.includes('#') || seen.has(slug)) return
      
      const name = link.textContent?.trim() || ''
      if (!name || name.length < 2 || name.length > 100) return
      
      const lower = name.toLowerCase()
      if (lower.includes('view all') || lower.includes('browse') || lower.includes('discover')) return
      
      seen.add(slug)
      results.push({ name, slug })
    })
    
    return results
  })
  
  await browser.close()
  
  console.log('Found', companies.length, 'companies from Nodesk\n')
  
  let added = 0, existed = 0
  
  for (const c of companies) {
    const slug = slugify(c.name)
    const existing = await prisma.company.findFirst({
      where: { OR: [{ slug }, { name: c.name }] }
    })
    
    if (existing) {
      existed++
      continue
    }
    
    await prisma.company.create({
      data: {
        name: c.name,
        slug,
        logoUrl: 'https://logo.clearbit.com/' + slug.replace(/-/g, '') + '.com',
      }
    })
    added++
  }
  
  const total = await prisma.company.count()
  console.log('Existed:', existed, '| Added:', added, '| Total:', total)
  
  await prisma.$disconnect()
}

main()
