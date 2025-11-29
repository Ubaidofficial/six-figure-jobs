// Research job boards to understand their structure

async function research() {
  const boards = [
    { name: 'RemoteAI.io', url: 'https://remoteai.io/' },
    { name: 'Remote100k.com', url: 'https://remote100k.com/' },
    { name: 'WeWorkRemotely', url: 'https://weworkremotely.com/remote-100k-or-more-salary-jobs' },
    { name: 'Nodesk', url: 'https://nodesk.co/remote-jobs/' },
  ]

  for (const board of boards) {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`${board.name}: ${board.url}`)
    console.log('='.repeat(50))
    
    try {
      const res = await fetch(board.url)
      const html = await res.text()
      
      // Summary stats
      console.log(`Status: ${res.status}`)
      console.log(`HTML size: ${(html.length / 1024).toFixed(1)} KB`)
      
      // Check for common patterns
      const hasJson = html.includes('application/json') || html.includes('__NEXT_DATA__')
      const hasApi = html.includes('/api/') || html.includes('api.')
      const jobLinks = (html.match(/href="[^"]*job[^"]*"/gi) || []).length
      const companyMentions = (html.match(/company/gi) || []).length
      
      console.log(`Has JSON data: ${hasJson}`)
      console.log(`Has API refs: ${hasApi}`)
      console.log(`Job link patterns: ${jobLinks}`)
      console.log(`Company mentions: ${companyMentions}`)
      
      // Check if it's a SPA/Framer site
      const isFramer = html.includes('framer.com') || html.includes('Framer')
      const isNextJs = html.includes('__NEXT_DATA__')
      const isReact = html.includes('react') || html.includes('React')
      
      console.log(`Framework: ${isFramer ? 'Framer' : isNextJs ? 'Next.js' : isReact ? 'React' : 'Unknown'}`)
      
      // Extract some job/company patterns
      const greenhouseLinks = (html.match(/greenhouse\.io/gi) || []).length
      const leverLinks = (html.match(/lever\.co/gi) || []).length
      const ashbyLinks = (html.match(/ashbyhq/gi) || []).length
      
      console.log(`ATS links: Greenhouse(${greenhouseLinks}) Lever(${leverLinks}) Ashby(${ashbyLinks})`)
      
    } catch (e: any) {
      console.log(`Error: ${e.message}`)
    }
  }
}

research()
