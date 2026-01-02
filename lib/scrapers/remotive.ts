// lib/scrapers/remotive.ts

import axios from 'axios'
import { ingestBoardJob } from '../jobs/ingestBoardJob'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'
import { extractApplyDestinationFromHtml } from './utils/extractApplyLink'
import { detectATS, getCompanyJobsUrl, isExternalToHost, toAtsProvider } from './utils/detectATS'
import { saveCompanyATS } from './utils/saveCompanyATS'

const BOARD = 'remotive'

type ProcessedJob = {
  id: string
  title: string
  company: string
  companyLogo?: string
  location: string
  salary: string
  minSalary: number
  maxSalary: number
  type: string
  url: string
  applyUrl: string
  postedDate: string
  source: string
  tags: string[]
  description: string
  requirements: string[]
  benefits: string[]
  skills: string[]
  remote: boolean
  verified: boolean
  raw?: any
}

export default async function scrapeRemotive() {
  console.log('[Remotive] Starting scrape...')

  try {
    const jobs: ProcessedJob[] = []

    const searchTerms = [
      // Keep existing ML/AI (8 terms)
      'machine learning',
      'artificial intelligence',
      'data scientist',
      'ml engineer',
      'ai engineer',
      'deep learning',
      'nlp',
      'computer vision',

      // High-paying tech roles (expanded)
      'senior software engineer',
      'staff engineer',
      'principal engineer',
      'senior backend engineer',
      'senior frontend engineer',
      'senior full stack',
      'lead engineer',
      'engineering manager',
      'senior devops',
      'senior platform engineer',
      'site reliability engineer',
      'senior security engineer',
      'cloud architect',
      'senior data engineer',
      'tech lead',
      'vp engineering',
      'director of engineering',
      'head of engineering',
      'senior product manager',
      'technical architect',
    ]

    const categories = [
      'software-dev',
      'engineering',
      'devops',
      'backend',
      'frontend',
      'full-stack',
      'data',
      'product',
      'management',
      'security',
    ]

    console.log(`[Remotive] Search terms: ${searchTerms.length}`)
    console.log(`[Remotive] Categories: ${categories.length}`)

    // ----- search-based -----
    const searchPromises = searchTerms.map((term) =>
      fetchJobsBySearch(term).catch((err: any) => {
        console.error(`  Error searching "${term}":`, err?.message ?? err)
        return [] as ProcessedJob[]
      })
    )

    const searchResults = await Promise.allSettled(searchPromises)
    for (const res of searchResults) {
      if (res.status === 'fulfilled') jobs.push(...res.value)
    }

    // ----- category-based -----
    const categoryPromises = categories.map((category) =>
      fetchJobsByCategory(category).catch((err: any) => {
        console.error(`  Error fetching category "${category}":`, err?.message ?? err)
        return [] as ProcessedJob[]
      })
    )

    const categoryResults = await Promise.allSettled(categoryPromises)
    for (const res of categoryResults) {
      if (res.status === 'fulfilled') jobs.push(...res.value)
    }

    // De-dupe by id
    const uniqueJobs = Array.from(
      new Map(jobs.map((job) => [job.id, job])).values()
    )

    // Strict $100k+ filter
    const highPayingJobs = uniqueJobs.filter((job) => job.minSalary >= 100)

    const avgDescLength =
      uniqueJobs.length > 0
        ? Math.round(
            uniqueJobs.reduce((sum, j) => sum + (j.description?.length || 0), 0) /
              uniqueJobs.length
          )
        : 0

    console.log(`[Remotive] Found ${uniqueJobs.length} total jobs`)
    console.log(`[Remotive] High-paying ($100k+): ${highPayingJobs.length}`)
    console.log(`[Remotive] Average description length: ${avgDescLength} chars`)

    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    for (const job of highPayingJobs) {
      let applyUrl = job.applyUrl
      let discoveredApplyUrl: string | null = null

      if (applyUrl && !isExternalToHost(applyUrl, 'remotive.com')) {
        discoveredApplyUrl = await discoverRemotiveApplyUrl(job.url)
        if (discoveredApplyUrl) applyUrl = discoveredApplyUrl
      }

      const atsType = detectATS(applyUrl)
      const explicitAtsProvider = toAtsProvider(atsType)
      const explicitAtsUrl = explicitAtsProvider ? getCompanyJobsUrl(applyUrl, atsType) : null

      // Only store CompanyATS mappings when we have a recognizable ATS provider.
      // Remotive frequently returns mailto links or generic company URLs, which aren't useful for ATS discovery.
      if (job.company && explicitAtsProvider && isExternalToHost(applyUrl, 'remotive.com')) {
        await saveCompanyATS(job.company, applyUrl, 'remotive')
      }

      const descriptionHtml =
        job.raw?.fullDescription && typeof job.raw.fullDescription === 'string'
          ? job.raw.fullDescription
          : job.description

      const descriptionText =
        job.raw?._sixFigureJobs?.descriptionText && typeof job.raw._sixFigureJobs.descriptionText === 'string'
          ? job.raw._sixFigureJobs.descriptionText
          : stripHtml(descriptionHtml || '')

      const result = await ingestBoardJob(BOARD, {
        externalId: job.id,
        title: job.title,
        url: job.url,
        applyUrl,
        rawCompanyName: job.company || 'Unknown company',
        locationText: job.location,
        isRemote: job.remote,
        employmentType: job.type || null,
        salaryMin: job.minSalary ? job.minSalary * 1000 : null,
        salaryMax: job.maxSalary ? job.maxSalary * 1000 : null,
        salaryCurrency: 'USD',
        salaryInterval: 'year',
        descriptionHtml: descriptionHtml || null,
        descriptionText: descriptionText || null,
        explicitAtsProvider,
        explicitAtsUrl,
        raw: job.raw ?? null,
      })
      addBoardIngestResult(stats, result)
    }

    console.log(`[Remotive] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[Remotive] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function fetchJobsBySearch(searchTerm: string): Promise<ProcessedJob[]> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(
    searchTerm
  )}&limit=100`

  console.log(`  Searching: "${searchTerm}"…`)

  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
    timeout: 15000,
  })

  const jobData: any[] = response.data.jobs || []
  console.log(`    Found ${jobData.length} jobs for "${searchTerm}"`)

  return jobData.map(processJob).filter((j): j is ProcessedJob => j !== null)
}

async function fetchJobsByCategory(category: string): Promise<ProcessedJob[]> {
  const url = `https://remotive.com/api/remote-jobs?category=${category}&limit=200`

  console.log(`  Fetching category: ${category}…`)

  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
    timeout: 15000,
  })

  const jobData: any[] = response.data.jobs || []
  const relevantJobs = jobData // No filter, all are tech jobs

  console.log(`    Found ${relevantJobs.length} jobs in ${category}`)
  return relevantJobs.map(processJob).filter((j): j is ProcessedJob => j !== null)
}

function processJob(job: any): ProcessedJob | null {
  try {
    const title = (job.title || '').trim()
    const company = (job.company_name || '').trim()

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
      return null
    }

    const salaryInfo = extractSalary(job, title, job.description)

    let jobType = 'Full-time'
    if (job.job_type) {
      const typeMap: Record<string, string> = {
        full_time: 'Full-time',
        part_time: 'Part-time',
        contract: 'Contract',
        freelance: 'Freelance',
        internship: 'Internship',
      }
      jobType = typeMap[job.job_type] || job.job_type
    }

    let location: string = job.candidate_required_location || 'Remote'
    if (location.toLowerCase().includes('worldwide')) {
      location = 'Anywhere in the World'
    }

    const tags: string[] = ['Remote', 'Verified']
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

    const fullDescription: string =
      job.description ||
      `${title} at ${company || 'this company'}. Remote ${jobType.toLowerCase()} position.`

    // Keep the full description for AI enrichment (do not truncate).
    // The Remotive API description is typically HTML.
    const description = fullDescription

    const requirements = generateRequirements(tags, titleLower, skills)
    const benefits = generateBenefits(salaryInfo.salary, location)

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
      company,
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
      raw: {
        ...job,
        fullDescription: job.description,
        descriptionLength: (job.description || '').length,
        extractedSkills: skills,
        extractedRequirements: requirements,
        extractedBenefits: benefits,
        _sixFigureJobs: {
          descriptionText: stripHtml(fullDescription),
        },
      },
    }
  } catch (err: any) {
    console.error('Error processing Remotive job:', err?.message ?? err)
    return null
  }
}

function extractSalary(
  job: any,
  title: string,
  description: string | null
): { salary: string; minSalary: number; maxSalary: number } {
  // FIRST: Check if API provides salary directly
  if (job && job.salary_min != null && job.salary_max != null) {
    const minRaw = Number(job.salary_min)
    const maxRaw = Number(job.salary_max)
    if (
      Number.isFinite(minRaw) &&
      Number.isFinite(maxRaw) &&
      minRaw > 0 &&
      maxRaw > 0
    ) {
      // Some feeds use annual USD (e.g., 120000), some use "k" units (e.g., 120).
      const min = minRaw >= 1000 ? Math.round(minRaw / 1000) : minRaw
      const max = maxRaw >= 1000 ? Math.round(maxRaw / 1000) : maxRaw
      return {
        salary: `$${min}k - $${max}k`,
        minSalary: min,
        maxSalary: max,
      }
    }
  }

  if (job && typeof job.salary === 'number') {
    const baseRaw = Number(job.salary)
    const base =
      Number.isFinite(baseRaw) && baseRaw >= 1000
        ? Math.round(baseRaw / 1000)
        : baseRaw
    if (Number.isFinite(base) && base > 0) {
      return {
        salary: `$${base}k`,
        minSalary: base,
        maxSalary: base + 50,
      }
    }
  }

  const salaryString: string | null =
    typeof job?.salary === 'string' ? job.salary : null

  if (salaryString && typeof salaryString === 'string') {
    const cleanSalary = salaryString.trim()

    let match =
      cleanSalary.match(
        /\$(\d{1,3}),?(\d{3})?\s*[-–—to]+\s*\$(\d{1,3}),?(\d{3})?/i
      ) || null

    if (match) {
      let min = parseInt(match[1], 10)
      let max = parseInt(match[3], 10)

      if (!match[2] && min < 1000) {
        // already k
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

    match = cleanSalary.match(/\$(\d{2,3})k?\+/i)
    if (match) {
      const min = parseInt(match[1], 10)
      return {
        salary: `$${min}k+`,
        minSalary: min,
        maxSalary: min + 100,
      }
    }

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

  const text = (title + ' ' + (description || '')).toLowerCase()
  const descMatch =
    text.match(/\$(\d{3}),?(\d{3})?\s*[-–—to]+\s*\$(\d{3}),?(\d{3})?/) || null

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

  const titleLower = title.toLowerCase()

  if (titleLower.includes('staff') || titleLower.includes('principal')) {
    return { salary: '$180k - $300k (est.)', minSalary: 180, maxSalary: 300 }
  } else if (titleLower.includes('senior') || titleLower.includes('lead')) {
    return { salary: '$130k - $220k (est.)', minSalary: 130, maxSalary: 220 }
  } else if (titleLower.includes('director') || titleLower.includes('head')) {
    return { salary: '$200k - $300k (est.)', minSalary: 200, maxSalary: 300 }
  } else if (titleLower.includes('manager')) {
    return { salary: '$140k - $200k (est.)', minSalary: 140, maxSalary: 200 }
  }

  return { salary: '$100k - $160k (est.)', minSalary: 100, maxSalary: 160 }
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

async function discoverRemotiveApplyUrl(jobUrl: string): Promise<string | null> {
  try {
    const parsed = new URL(jobUrl)
    const path = parsed.pathname.replace(/\/+$/, '')
    const last = path.split('/').pop() || ''
    const m = last.match(/-(\d+)$/)
    const jobId = m?.[1] || null

    if (jobId) {
      const res = await axios.post(
        `https://remotive.com/job/application/${encodeURIComponent(jobId)}`,
        {
          jsonrpc: '2.0',
          method: 'call',
          params: { source: 'job_detail_page' },
          id: 128144762,
        },
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Referer: jobUrl,
          },
          timeout: 15000,
        },
      )

      const urlRaw = (res?.data as any)?.result?.url
      const url = typeof urlRaw === 'string' ? urlRaw.trim() : ''
      if (!url) return null

      if (/^https?:\/\//i.test(url)) return url
      if (url.includes('@') && !url.includes('://')) return `mailto:${url}`
    }

    const res = await axios.get(jobUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    })

    const html = typeof res.data === 'string' ? res.data : ''
    if (!html) return null

    return extractApplyDestinationFromHtml(html, jobUrl)
  } catch {
    return null
  }
}

function extractSkills(title: string, description: string): string[] {
  const skills: string[] = []
  const skillKeywords: Record<string, string> = {
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

function generateRequirements(
  tags: string[],
  _titleLower: string,
  skills: string[]
): string[] {
  const requirements = [
    'Remote work experience',
    'Strong communication skills',
  ]

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

function generateBenefits(salary: string, location: string): string[] {
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

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
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
