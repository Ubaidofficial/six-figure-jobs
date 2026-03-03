// Research job boards to understand their structure

import { format as __format } from 'node:util'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function research() {
  const boards = [
    { name: 'RemoteAI.io', url: 'https://remoteai.io/' },
    { name: 'Remote100k.com', url: 'https://remote100k.com/' },
    { name: 'WeWorkRemotely', url: 'https://weworkremotely.com/remote-100k-or-more-salary-jobs' },
    { name: 'Nodesk', url: 'https://nodesk.co/remote-jobs/' },
  ]

  for (const board of boards) {
    __slog(`\n${'='.repeat(50)}`)
    __slog(`${board.name}: ${board.url}`)
    __slog('='.repeat(50))
    
    try {
      const res = await fetch(board.url)
      const html = await res.text()
      
      // Summary stats
      __slog(`Status: ${res.status}`)
      __slog(`HTML size: ${(html.length / 1024).toFixed(1)} KB`)
      
      // Check for common patterns
      const hasJson = html.includes('application/json') || html.includes('__NEXT_DATA__')
      const hasApi = html.includes('/api/') || html.includes('api.')
      const jobLinks = (html.match(/href="[^"]*job[^"]*"/gi) || []).length
      const companyMentions = (html.match(/company/gi) || []).length
      
      __slog(`Has JSON data: ${hasJson}`)
      __slog(`Has API refs: ${hasApi}`)
      __slog(`Job link patterns: ${jobLinks}`)
      __slog(`Company mentions: ${companyMentions}`)
      
      // Check if it's a SPA/Framer site
      const isFramer = html.includes('framer.com') || html.includes('Framer')
      const isNextJs = html.includes('__NEXT_DATA__')
      const isReact = html.includes('react') || html.includes('React')
      
      __slog(`Framework: ${isFramer ? 'Framer' : isNextJs ? 'Next.js' : isReact ? 'React' : 'Unknown'}`)
      
      // Extract some job/company patterns
      const greenhouseLinks = (html.match(/greenhouse\.io/gi) || []).length
      const leverLinks = (html.match(/lever\.co/gi) || []).length
      const ashbyLinks = (html.match(/ashbyhq/gi) || []).length
      
      __slog(`ATS links: Greenhouse(${greenhouseLinks}) Lever(${leverLinks}) Ashby(${ashbyLinks})`)
      
    } catch (e: any) {
      __slog(`Error: ${e.message}`)
    }
  }
}

research()
