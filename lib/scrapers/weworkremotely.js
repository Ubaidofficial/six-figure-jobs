import axios from 'axios'
import * as cheerio from 'cheerio'

export async function scrapeWeWorkRemotely() {
  try {
    console.log('Scraping We Work Remotely...')

    const response = await axios.get(
      'https://weworkremotely.com/remote-100k-or-more-salary-jobs',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000
      }
    )

    const $ = cheerio.load(response.data)
    const jobs = []

    // AI/ML related keywords (kept for tagging, not for filtering)
    const mlKeywords = [
      'machine learning',
      'ml engineer',
      'ml ',
      'artificial intelligence',
      'ai engineer',
      'data scientist',
      'deep learning',
      'nlp',
      'computer vision',
      'neural network',
      'pytorch',
      'tensorflow',
      'data science',
      'ai researcher',
      'ml researcher',
      'mlops',
      'ai/ml',
      'ai ',
      'data engineer'
    ]

    console.log('  Looking for job listings...')

    const jobSection = $('section.jobs')
    const jobElements = jobSection.find('li')

    console.log(`  Found ${jobElements.length} potential job elements`)

    jobElements.each((i, element) => {
      try {
        const $el = $(element)

        // Skip "View all" and navigation elements
        const classes = $el.attr('class') || ''
        const textRaw = $el.text() || ''
        if (classes.includes('view-all') || textRaw.includes('View all')) {
          return
        }

        // Main job link
        const $link = $el.find('a').first()
        if (!$link.length) return

        const href = $link.attr('href')
        if (!href || !href.includes('/remote-jobs/')) return

        const fullUrl = href.startsWith('http')
          ? href
          : `https://weworkremotely.com${href}`

        // Parse lines of text
        const fullText = textRaw.trim()
        const lines = fullText
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)

        if (lines.length < 3) return // need at least title, company, location

        let lineIndex = 0

        // 1. Job Title
        const title = lines[lineIndex++]
        if (!title || title.length < 3) return

        // 2. Posted date tag (like "1d", "3d")
        let postedDate = 'Recently'
        if (lines[lineIndex] && /^\d+[dhwmy]$/.test(lines[lineIndex])) {
          const timeStr = lines[lineIndex++]
          postedDate = parsePostedTime(timeStr)
        }

        // 3. Company
        const company = lines[lineIndex++] || 'Remote Company'

        // 4. Base location
        const rawLocation = lines[lineIndex++] || 'Remote'

        // Tags & meta
        const tags = ['Remote', 'Verified', '$100k+']
        let isFeatured = false
        let isTop100 = false

        while (lineIndex < lines.length) {
          const line = lines[lineIndex]

          if (line === 'Featured') {
            tags.push('Featured')
            isFeatured = true
            lineIndex++
          } else if (line === 'Top 100') {
            tags.push('Top 100')
            isTop100 = true
            lineIndex++
          } else {
            break
          }
        }

        // 5. Job type
        let jobType = 'Full-time'
        if (
          lineIndex < lines.length &&
          ['Full-Time', 'Contract', 'Part-Time'].includes(lines[lineIndex])
        ) {
          jobType = lines[lineIndex++]
        }

        // 6. Salary line (might say "$100,000 or more USD")
        let salaryLine = ''
        if (lineIndex < lines.length && lines[lineIndex].includes('$')) {
          salaryLine = lines[lineIndex++]
        }

        // 7. Region
        let region = 'Remote'
        const remainingLines = lines.slice(lineIndex)

        if (remainingLines.some((l) => l.includes('Anywhere in the World'))) {
          region = 'Anywhere in the World'
        } else if (
          remainingLines.some(
            (l) => l.includes('🇺🇸') || l.includes('United States')
          )
        ) {
          region = 'United States'
        } else if (remainingLines.length > 0) {
          const firstRemaining = remainingLines[0]
          if (firstRemaining.length < 50 && !firstRemaining.includes('http')) {
            region = firstRemaining
          }
        }

        const location =
          rawLocation === 'Remote' ? region : `${rawLocation}, ${region}`

        // AI/ML flag (no longer used for filtering – only informative)
        const titleLower = title.toLowerCase()
        const fullTextLower = fullText.toLowerCase()
        const isMLJob = mlKeywords.some(
          (keyword) =>
            titleLower.includes(keyword) || fullTextLower.includes(keyword)
        )

        if (isMLJob) {
          tags.push('AI/ML')
        }

        // Salary: this page is already "100k or more", we estimate numeric range
        let minSalary = 100
        let maxSalary = 200
        let salary = '$100k+'

        if (titleLower.includes('senior') || titleLower.includes('sr.')) {
          minSalary = 130
          maxSalary = 220
          salary = '$130k - $220k'
        } else if (
          titleLower.includes('staff') ||
          titleLower.includes('principal')
        ) {
          minSalary = 180
          maxSalary = 300
          salary = '$180k - $300k'
        } else if (titleLower.includes('lead')) {
          minSalary = 150
          maxSalary = 250
          salary = '$150k - $250k'
        }

        // Seniority tags
        if (titleLower.includes('senior')) tags.push('Senior')
        if (titleLower.includes('lead')) tags.push('Lead')
        if (titleLower.includes('staff')) tags.push('Staff')
        if (titleLower.includes('principal')) tags.push('Principal')

        // Job ID from slug
        const urlParts = fullUrl.split('/')
        const jobSlug =
          urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2]
        const jobId = `wwr-${jobSlug}`

        // Logo via Clearbit
        const companySlug = company
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '')
        const logo = companySlug
          ? `https://logo.clearbit.com/${companySlug}.com`
          : ''

        // Skills extracted from title + text
        const skills = extractSkills(title, fullText)

        // Requirements & benefits
        const requirements = generateRequirements(tags)
        const benefits = generateBenefits(salary, isFeatured, isTop100)

        jobs.push({
          id: jobId,
          title,
          company,
          companyLogo: logo,
          location,
          salary,
          minSalary,
          maxSalary,
          type: jobType,
          url: fullUrl,
          postedDate,
          source: 'WeWorkRemotely',
          tags: [...new Set(tags)],
          description: `${title} position at ${company}. ${jobType} remote opportunity with compensation ${salary}. ${region}. ${
            salaryLine || ''
          }`,
          requirements,
          benefits,
          applyUrl: fullUrl,
          skills,
          remote: true,
          verified: true,
          featured: isFeatured,
          top100: isTop100
        })
      } catch (err) {
        console.error('Error processing We Work Remotely job:', err.message)
      }
    })

    console.log(
      `We Work Remotely: Found ${jobs.length} $100k+ jobs (all categories)`
    )
    return jobs
  } catch (error) {
    console.error('We Work Remotely error:', error.message)
    return []
  }
}

function parsePostedTime(timeStr) {
  // Convert "1d", "3d", "14d", etc. to readable text
  const match = timeStr.match(/^(\d+)([dhwmy])$/)
  if (!match) return 'Recently'

  const [, num, unit] = match
  const unitMap = {
    d: 'day',
    h: 'hour',
    w: 'week',
    m: 'month',
    y: 'year'
  }

  const unitName = unitMap[unit] || 'day'
  const plural = parseInt(num, 10) > 1 ? 's' : ''

  return `${num} ${unitName}${plural} ago`
}

function extractSkills(title, text) {
  const skills = []
  const skillKeywords = {
    python: 'Python',
    pytorch: 'PyTorch',
    tensorflow: 'TensorFlow',
    keras: 'Keras',
    'scikit-learn': 'Scikit-learn',
    pandas: 'Pandas',
    numpy: 'NumPy',
    aws: 'AWS',
    gcp: 'GCP',
    azure: 'Azure',
    kubernetes: 'Kubernetes',
    docker: 'Docker',
    sql: 'SQL',
    spark: 'Spark',
    hadoop: 'Hadoop',
    nlp: 'NLP',
    'computer vision': 'Computer Vision',
    'deep learning': 'Deep Learning',
    'machine learning': 'Machine Learning',
    mlops: 'MLOps',
    java: 'Java',
    scala: 'Scala',
    'c++': 'C++',
    rust: 'Rust',
    go: 'Go',
    javascript: 'JavaScript',
    react: 'React',
    node: 'Node.js',
    llm: 'LLM',
    genai: 'Generative AI',
    transformers: 'Transformers'
  }

  const textLower = (title + ' ' + text).toLowerCase()

  for (const [keyword, skill] of Object.entries(skillKeywords)) {
    if (textLower.includes(keyword)) {
      skills.push(skill)
    }
  }

  return [...new Set(skills)].slice(0, 10)
}

function generateRequirements(tags) {
  const base = [
    'Strong technical skills',
    'Remote work experience',
    'Excellent communication'
  ]

  if (tags.includes('Senior') || tags.includes('Lead')) {
    return [
      ...base,
      '5+ years experience',
      'Leadership skills',
      'Mentoring ability'
    ]
  } else if (tags.includes('Staff') || tags.includes('Principal')) {
    return [
      ...base,
      '8+ years experience',
      'Architecture experience',
      'Technical leadership'
    ]
  }
  return [...base, '3+ years experience', 'Self-motivated', 'Team player']
}

function generateBenefits(salary, isFeatured, isTop100) {
  const benefits = [
    'Fully remote',
    'Flexible hours',
    `Competitive salary ${salary}`,
    'Professional development',
    'Health benefits'
  ]

  if (isFeatured) {
    benefits.push('Featured employer')
  }

  if (isTop100) {
    benefits.push('Top 100 company')
  }

  return benefits
}
