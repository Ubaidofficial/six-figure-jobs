// lib/scrapers/nodesk.ts
// Nodesk.co scraper - Puppeteer-based for JavaScript-rendered content

import puppeteer from 'puppeteer'
import type { ScrapedJobInput } from '../ingest/types'
import { makeBoardSource } from '../ingest/sourcePriority'

const BOARD_NAME = 'nodesk'
const BASE_URL = 'https://nodesk.co'

const CATEGORY_SLUGS = new Set([
  'customer-support', 'design', 'engineering', 'marketing', 'non-tech',
  'operations', 'product', 'sales', 'other', 'collections', 'new',
  'north-america', 'europe', 'worldwide', 'react-native', 'software-engineer',
  'product-designer', 'ux-designer', 'data-scientist', 'devops', 'backend',
  'frontend', 'full-stack', 'mobile', 'ios', 'android', 'machine-learning'
])

// Extract company name from slug like "clipboard-health-billing-representative"
function extractCompanyFromSlug(slug: string, title: string): string {
  // Remove the title part from the slug to get company
  const titleSlug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  
  // Try to find where title starts in slug
  const parts = slug.split('-')
  const titleParts = titleSlug.split('-')
  
  // Find overlap
  for (let i = 1; i < parts.length - 1; i++) {
    const remaining = parts.slice(i).join('-')
    if (titleParts.some(tp => remaining.startsWith(tp))) {
      const companyParts = parts.slice(0, i)
      if (companyParts.length > 0) {
        return companyParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
      }
    }
  }
  
  // Fallback: take first 1-3 words as company
  const company = parts.slice(0, Math.min(3, parts.length - 2))
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
  
  return company || 'Unknown'
}

export async function scrapeNodesk(): Promise<ScrapedJobInput[]> {
  console.log('Scraping Nodesk with Puppeteer...')
  const jobs: ScrapedJobInput[] = []
  
  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
    
    await page.goto(BASE_URL + '/remote-jobs/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    
    await new Promise(r => setTimeout(r, 3000))
    
    const jobData = await page.evaluate((baseUrl, categorySet) => {
      const results: any[] = []
      const seen = new Set()
      const categories = new Set(categorySet)
      
      document.querySelectorAll('a[href*="/remote-jobs/"]').forEach((link) => {
        const href = link.getAttribute('href')
        if (!href || seen.has(href)) return
        
        const slug = href.replace(/\/$/, '').split('/').pop() || ''
        
        if (!slug || slug === 'remote-jobs' || slug.length < 10) return
        if (categories.has(slug)) return
        if (href.includes('#')) return
        
        const hyphenCount = (slug.match(/-/g) || []).length
        if (hyphenCount < 2) return
        
        const title = link.textContent?.trim() || ''
        if (!title || title.length < 5 || title.length > 150) return
        
        const titleLower = title.toLowerCase()
        if (titleLower.includes('testimonial') || titleLower.includes('post a job')) return
        
        const url = href.startsWith('http') ? href : baseUrl + href
        
        seen.add(href)
        results.push({ externalId: slug, title, url })
      })
      
      return results
    }, BASE_URL, Array.from(CATEGORY_SLUGS))
    
    for (const job of jobData) {
      const company = extractCompanyFromSlug(job.externalId, job.title)
      jobs.push({
        source: makeBoardSource(BOARD_NAME),
        externalId: job.externalId,
        title: job.title,
        rawCompanyName: company,
        locationText: 'Remote',
        url: job.url,
        isRemote: true,
      })
    }
    
    console.log('  Found ' + jobs.length + ' jobs from Nodesk')
    
  } catch (e) {
    console.error('Nodesk scrape error:', e)
  } finally {
    if (browser) await browser.close()
  }
  
  return jobs
}

export default scrapeNodesk
