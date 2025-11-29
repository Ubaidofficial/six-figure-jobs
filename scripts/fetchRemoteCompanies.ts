// Fetch company lists from remote job sites

async function fetchRemote100kCompanies(): Promise<string[]> {
  try {
    const res = await fetch('https://remote100k.com/remote-companies')
    const html = await res.text()
    
    // Extract company names from the page
    const matches = html.match(/\/company\/([^"]+)/g) || []
    const slugs = matches.map(m => m.replace('/company/', ''))
    return [...new Set(slugs)]
  } catch (e) {
    console.error('Error fetching Remote100k:', e)
    return []
  }
}

async function fetchWeWorkRemotely(): Promise<string[]> {
  try {
    const res = await fetch('https://weworkremotely.com/remote-100k-or-more-salary-jobs')
    const html = await res.text()
    
    // Extract company names - look for company links
    const matches = html.match(/class="company"[^>]*>([^<]+)</g) || []
    const names = matches.map(m => {
      const match = m.match(/>([^<]+)</)
      return match ? match[1].trim() : ''
    }).filter(Boolean)
    return [...new Set(names)]
  } catch (e) {
    console.error('Error fetching WeWorkRemotely:', e)
    return []
  }
}

async function main() {
  console.log('Fetching company lists...\n')
  
  const remote100k = await fetchRemote100kCompanies()
  console.log(`Remote100k companies (${remote100k.length}):`)
  remote100k.slice(0, 20).forEach(c => console.log(`  ${c}`))
  if (remote100k.length > 20) console.log(`  ... and ${remote100k.length - 20} more`)
  
  console.log('')
  
  const wwr = await fetchWeWorkRemotely()
  console.log(`WeWorkRemotely $100k+ companies (${wwr.length}):`)
  wwr.slice(0, 20).forEach(c => console.log(`  ${c}`))
  if (wwr.length > 20) console.log(`  ... and ${wwr.length - 20} more`)
}

main()
