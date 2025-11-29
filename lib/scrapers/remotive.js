import axios from 'axios'

export async function scrapeRemotive() {
  try {
    console.log('Scraping Remotive API...')

    const jobs = []

    // ML/AI-related search terms
    const searchTerms = [
      'machine learning',
      'artificial intelligence',
      'data scientist',
      'ml engineer',
      'ai engineer',
      'deep learning',
      'nlp',
      'computer vision',
    ]

    const categories = ['software-dev']

    // ----- Fetch by search terms in parallel -----
    const searchPromises = searchTerms.map((term) =>
      fetchJobsBySearch(term).catch((err) => {
        console.error(`Error searching for "${term}":`, err.message)
        return []
      })
    )

    const searchResults = await Promise.allSettled(searchPromises)
    for (const result of searchResults) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        jobs.push(...result.value)
      }
    }

    // ----- Fetch by categories in parallel -----
    const categoryPromises = categories.map((category) =>
      fetchJobsByCategory(category).catch((err) => {
        console.error(`Error fetching category "${category}":`, err.message)
        return []
      })
    )

    const categoryResults = await Promise.allSettled(categoryPromises)
    for (const result of categoryResults) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        jobs.push(...result.value)
      }
    }

    // De-duplicate by id
    const uniqueJobs = Array.from(
      new Map(jobs.map((job) => [job.id, job])).values()
    )

    // Strict $100k+ filter (minSalary comes from extractSalary / estimates)
    const highPayingJobs = uniqueJobs.filter((job) => job.minSalary >= 100)

    console.log(
      `Remotive: Found ${highPayingJobs.length} ML/AI jobs with estimated $100k+`
    )
    return highPayingJobs
  } catch (error) {
    console.error('Remotive error:', error.message)
    return []
  }
}

async function fetchJobsBySearch(searchTerm) {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(
    searchTerm
  )}&limit=100`

  console.log(`  Searching: "${searchTerm}"...`)

  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
    timeout: 15000,
  })

  const jobData = response.data.jobs || []
  console.log(`  Found ${jobData.length} jobs for "${searchTerm}"`)

  return jobData.map((job) => processJob(job)).filter((job) => job !== null)
}

async function fetchJobsByCategory(category) {
  const url = `https://remotive.com/api/remote-jobs?category=${category}&limit=200`

  console.log(`  Fetching category: ${category}...`)

  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
    timeout: 15000,
  })

  const jobData = response.data.jobs || []

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
    'data engineer',
    'llm',
    'generative ai',
    'gen ai',
    'transformers',
    'diffusion',
  ]

  const mlJobs = jobData.filter((job) => {
    const title = (job.title || '').toLowerCase()
    const description = (job.description || '').toLowerCase()
    const text = title + ' ' + description

    return mlKeywords.some((keyword) => text.includes(keyword))
  })

  console.log(`  Found ${mlJobs.length} ML/AI jobs in ${category}`)

  return mlJobs.map((job) => processJob(job)).filter((job) => job !== null)
}

function processJob(job) {
  try {
    const title = (job.title || '').trim()
    let company = (job.company_name || '').trim()

    if (!title || title.length < 5) return null

    const titleLower = title.toLowerCase()
    const badTitlePrefixes = [
      'apply now',
      'view all jobs',
      'see all jobs',
      'open positions',
      'current openings',
    ]
    if (badTitlePrefixes.some((p) => titleLower.startsWith(p))) {
      // Skip non-job rows
      return null
    }

    const salaryInfo = extractSalary(job.salary, title, job.description)

    // Job type
    let jobType = 'Full-time'
    if (job.job_type) {
      const typeMap = {
        full_time: 'Full-time',
        part_time: 'Part-time',
        contract: 'Contract',
        freelance: 'Freelance',
        internship: 'Internship',
      }
      jobType = typeMap[job.job_type] || job.job_type
    }

    // Location
    let location = job.candidate_required_location || 'Remote'
    if (location.toLowerCase().includes('worldwide')) {
      location = 'Anywhere in the World'
    }

    // Tags
    const tags = ['Remote', 'Verified']
    if (salaryInfo.minSalary >= 100) tags.push('$100k+')

    if (titleLower.includes('senior')) tags.push('Senior')
    if (titleLower.includes('lead')) tags.push('Lead')
    if (titleLower.includes('staff')) tags.push('Staff')
    if (titleLower.includes('principal')) tags.push('Principal')
    if (titleLower.includes('director')) tags.push('Director')
    if (titleLower.includes('head')) tags.push('Head')
    if (titleLower.includes('manager')) tags.push('Manager')

    if (job.category) tags.push(job.category)

    const skills = extractSkills(title, job.description || '')

    // Description
    let description =
      job.description ||
      `${title} at ${company || 'this company'}. Remote ${jobType.toLowerCase()} position.`
    description = description
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500)

    const requirements = generateRequirements(tags, titleLower, skills)
    const benefits = generateBenefits(salaryInfo.salary, location, company)

    let postedDate = 'Recently'
    if (job.publication_date) {
      postedDate = formatDate(job.publication_date)
    }

    const logoCompany = (company || '')
      .toLowerCase()
      .replace(/[^\w]/g, '')

    return {
      id: `remotive-${job.id}`,
      title,
      company, // may be empty; normalization can infer from URL if needed
      companyLogo:
        job.company_logo ||
        (logoCompany
          ? `https://logo.clearbit.com/${logoCompany}.com`
          : ''),
      location,
      salary: salaryInfo.salary,
      minSalary: salaryInfo.minSalary,
      maxSalary: salaryInfo.maxSalary,
      type: jobType,
      url: job.url,
      postedDate,
      source: 'Remotive',
      tags: [...new Set(tags)],
      description,
      requirements,
      benefits,
      applyUrl: job.url,
      skills,
      remote: true,
      verified: true,
    }
  } catch (err) {
    console.error('Error processing Remotive job:', err.message)
    return null
  }
}

function extractSalary(salaryString, title, description) {
  if (salaryString && typeof salaryString === 'string') {
    const cleanSalary = salaryString.trim()

    // $XXX,XXX - $XXX,XXX or $XXXk - $XXXk
    let match = cleanSalary.match(
      /\$(\d{1,3}),?(\d{3})?\s*[-–—to]+\s*\$(\d{1,3}),?(\d{3})?/i
    )
    if (match) {
      let min = parseInt(match[1], 10)
      let max = parseInt(match[3], 10)

      if (!match[2] && min < 1000) {
        // already in k
      } else {
        min = parseInt(match[1] + (match[2] || '000'), 10) / 1000
        max = parseInt(match[3] + (match[4] || '000'), 10) / 1000
      }

      return {
        salary: `$${min}k - $${max}k`,
        minSalary: min,
        maxSalary: max,
      }
    }

    // $XXXk+
    match = cleanSalary.match(/\$(\d{2,3})k?\+/i)
    if (match) {
      const min = parseInt(match[1], 10)
      return {
        salary: `$${min}k+`,
        minSalary: min,
        maxSalary: min + 100,
      }
    }

    // "40000-50000"
    match = cleanSalary.match(/(\d{5,6})\s*[-–—to]+\s*(\d{5,6})/i)
    if (match) {
      const min = parseInt(match[1], 10) / 1000
      const max = parseInt(match[2], 10) / 1000
      return {
        salary: `$${min}k - $${max}k`,
        minSalary: min,
        maxSalary: max,
      }
    }
  }

  // Look in description as last resort
  const text = (title + ' ' + (description || '')).toLowerCase()
  const descMatch = text.match(
    /\$(\d{3}),?(\d{3})?\s*[-–—to]+\s*\$(\d{3}),?(\d{3})?/
  )
  if (descMatch) {
    const min =
      parseInt(descMatch[1] + (descMatch[2] || '000'), 10) / 1000
    const max =
      parseInt(descMatch[3] + (descMatch[4] || '000'), 10) / 1000
    return {
      salary: `$${min}k - $${max}k`,
      minSalary: min,
      maxSalary: max,
    }
  }

  // Estimation based on seniority
  const titleLower = title.toLowerCase()

  if (titleLower.includes('staff') || titleLower.includes('principal')) {
    return {
      salary: '$180k - $300k (est.)',
      minSalary: 180,
      maxSalary: 300,
    }
  } else if (titleLower.includes('senior') || titleLower.includes('lead')) {
    return {
      salary: '$130k - $220k (est.)',
      minSalary: 130,
      maxSalary: 220,
    }
  } else if (titleLower.includes('director') || titleLower.includes('head')) {
    return {
      salary: '$200k - $350k (est.)',
      minSalary: 200,
      maxSalary: 350,
    }
  } else if (titleLower.includes('manager')) {
    return {
      salary: '$140k - $200k (est.)',
      minSalary: 140,
      maxSalary: 200,
    }
  }

  // Default mid-level ML/AI
  return {
    salary: '$100k - $160k (est.)',
    minSalary: 100,
    maxSalary: 160,
  }
}

function extractSkills(title, description) {
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
    'google cloud': 'Google Cloud',
    azure: 'Azure',
    kubernetes: 'Kubernetes',
    docker: 'Docker',
    sql: 'SQL',
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    spark: 'Apache Spark',
    hadoop: 'Hadoop',
    airflow: 'Airflow',
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
    golang: 'Go',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    react: 'React',
    'node.js': 'Node.js',
    llm: 'LLM',
    genai: 'Generative AI',
    'generative ai': 'Generative AI',
    transformers: 'Transformers',
    diffusion: 'Diffusion Models',
    rag: 'RAG',
    langchain: 'LangChain',
    'hugging face': 'Hugging Face',
    bert: 'BERT',
    gpt: 'GPT',
    'reinforcement learning': 'Reinforcement Learning',
  }

  const textLower = (title + ' ' + description).toLowerCase()

  for (const [keyword, skill] of Object.entries(skillKeywords)) {
    if (textLower.includes(keyword)) {
      skills.push(skill)
    }
  }

  return [...new Set(skills)].slice(0, 12)
}

function generateRequirements(tags, titleLower, skills) {
  const requirements = ['Remote work experience', 'Strong communication skills']

  if (tags.includes('Staff') || tags.includes('Principal')) {
    requirements.push(
      '8+ years of experience in ML/AI',
      'Technical leadership and mentoring',
      'System architecture expertise',
      'Track record of delivering production ML systems'
    )
  } else if (tags.includes('Senior') || tags.includes('Lead')) {
    requirements.push(
      '5+ years of ML/AI experience',
      'Production deployment experience',
      'Mentoring and collaboration skills',
      'Strong problem-solving abilities'
    )
  } else if (tags.includes('Director') || tags.includes('Head')) {
    requirements.push(
      '10+ years in ML/AI',
      'Team leadership and management',
      'Strategic planning abilities',
      'Cross-functional collaboration'
    )
  } else if (tags.includes('Manager')) {
    requirements.push(
      '5-7 years ML/AI experience',
      'Team management experience',
      'Project planning skills',
      'Stakeholder communication'
    )
  } else {
    requirements.push(
      '3+ years of ML/AI experience',
      'Self-motivated and proactive',
      'Collaborative team player',
      'Continuous learning mindset'
    )
  }

  if (skills.length > 0) {
    requirements.push(`Proficiency in: ${skills.slice(0, 3).join(', ')}`)
  }

  return requirements
}

function generateBenefits(salary, location, company) {
  const benefits = ['Fully remote work', 'Flexible work hours', 'Work-life balance']

  if (salary && !salary.includes('est.')) {
    benefits.push(`Transparent salary: ${salary}`)
  } else {
    benefits.push('Competitive compensation')
  }

  if (location.includes('Anywhere') || location.includes('Worldwide')) {
    benefits.push('Global team and opportunities')
  }

  benefits.push(
    'Professional development',
    'Cutting-edge technology',
    'Collaborative environment'
  )

  return benefits
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return dateString
  } catch {
    return 'Recently'
  }
}

export default scrapeRemotive
