// lib/scrapers/weworkremotely.ts
import * as cheerio from 'cheerio'
import type { ScrapedJobInput } from '../ingest/types'
import { makeBoardSource } from '../ingest/sourcePriority'

const BOARD_NAME = 'weworkremotely'
const BASE_URL = 'https://weworkremotely.com'

export async function scrapeWeWorkRemotely(): Promise<ScrapedJobInput[]> {
  console.log('Scraping WeWorkRemotely...')
  const jobs: ScrapedJobInput[] = []
  
  const res = await fetch(BASE_URL + '/remote-100k-or-more-salary-jobs', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  
  const html = await res.text()
  const $ = cheerio.load(html)
  
  $('li.new-listing-container').each((_, el) => {
    const $el = $(el)
    
    const $link = $el.find('a.listing-link--unlocked').first()
    const href = $link.attr('href')
    if (!href) return
    
    const title = $el.find('.new-listing__header__title').text().trim()
    if (!title) return
    
    const company = $el.find('.new-listing__company-name').text().trim().replace(/\s+/g, ' ')
    const location = $el.find('.new-listing__company-headquarters').text().trim()
    
    const url = href.startsWith('http') ? href : BASE_URL + href
    const externalId = href.split('/').pop() || String(Date.now())
    
    jobs.push({
      source: makeBoardSource(BOARD_NAME),
      externalId,
      title,
      rawCompanyName: company || 'Unknown',
      locationText: location || 'Remote',
      url,
      isRemote: true,
    })
  })
  
  console.log('  Found ' + jobs.length + ' jobs')
  return jobs
}

export default scrapeWeWorkRemotely
