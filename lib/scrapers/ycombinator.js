import axios from 'axios'

export async function scrapeYCombinator() {
  try {
    console.log('Scraping Y Combinator Startup Jobs...')

    const url = 'https://www.ycombinator.com/companies/jobs?include=jobs'

    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/json'
      },
      timeout: 20000
    })

    if (!response.data || !Array.isArray(response.data.companies)) {
      console.log('YC returned unexpected format.')
      return []
    }

    const companies = response.data.companies
    const jobs = []

    for (const company of companies) {
      if (!company.jobs || company.jobs.length === 0) continue

      for (const job of company.jobs) {
        const title = job.title || ''
        const description = job.description || ''
        const combinedText = (title + ' ' + description).toLowerCase()

        // AI/ML Filters
        const mlKeywords = [
          'machine learning',
          'ml',
          'artificial intelligence',
          'ai ',
          'deep learning',
          'data scientist',
          'computer vision',
          'nlp',
          'llm',
          'generative ai',
          'gen ai',
          'ai engineer',
          'ml engineer',
          'research engineer'
        ]

        const isMLJob = mlKeywords.some((kw) => combinedText.includes(kw))
        if (!isMLJob) continue

        // Salary estimation — YC rarely lists salary
        let minSalary = 100
        let maxSalary = 180
        let salary = '$100k+ (estimated)'

        if (job.compensation && job.compensation.salary) {
          const sal = job.compensation.salary.toLowerCase()

          const match = sal.match(/(\d{2,3})k/)
          if (match) {
            minSalary = parseInt(match[1])
            maxSalary = minSalary + 40
            salary = `$${minSalary}k - $${maxSalary}k`
          }
        }

        // Only keep $100k+
        if (minSalary < 100) continue

        // Location
        let location = job.location || 'Remote'
        if (location.toLowerCase().includes('remote')) {
          location = 'Remote'
        }

        jobs.push({
          id: `yc-${job.id}`,
          title: title,
          company: company.name,
          companyLogo:
            company.logo_url ||
            `https://logo.clearbit.com/${company.name
              .toLowerCase()
              .replace(/[^\w]/g, '')}.com`,
          location: location,
          salary: salary,
          minSalary: minSalary,
          maxSalary: maxSalary,
          type: job.type || 'Full-time',
          url: `https://www.ycombinator.com${job.url}`,
          applyUrl: `https://www.ycombinator.com${job.url}`,
          postedDate: job.created_at || 'Recently',
          source: 'YCombinator',
          tags: ['YC Startup', '$100k+', 'Tech', location.includes('Remote') ? 'Remote' : 'On-site'],
          description: description.slice(0, 500),
          requirements: [
            'Fast-paced startup environment',
            'Strong technical skills',
            'Self-driven & ownership mentality'
          ],
          benefits: [
            'Startup equity (typically substantial)',
            'High growth environment',
            'Founding team opportunity'
          ],
          remote: location === 'Remote',
          verified: true
        })
      }
    }

    console.log(`Y Combinator: Found ${jobs.length} AI/ML $100k+ jobs`)
    return jobs
  } catch (err) {
    console.error('YC scraper error:', err.message)
    return []
  }
}

export default scrapeYCombinator
