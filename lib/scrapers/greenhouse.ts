// lib/scrapers/greenhouse.ts

import { prisma } from '../prisma'

interface GreenhouseJob {
  id: number
  internal_job_id: number
  title: string
  location: {
    name: string
  } | null
  absolute_url: string
  updated_at: string | null
  created_at: string | null
  content: string
  metadata: any
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[]
}

// Simple helper to turn a slug like "scaleai" into "Scaleai"
function labelFromSlug(slug: string) {
  return slug
    .replace(/-/g, ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Fetch all jobs for a single Greenhouse board slug.
 * Uses `content=true` so we get the full HTML description (including pay transparency).
 */
async function fetchGreenhouseJobsForCompany(slug: string) {
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`

  const res = await fetch(apiUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'user-agent': 'Remote100kBot/1.0 (+https://remote100k.com)',
      accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Greenhouse error ${res.status} for slug ${slug}`)
  }

  const json = (await res.json()) as GreenhouseResponse
  const jobs = Array.isArray(json.jobs) ? json.jobs : []

  const companyLabel = labelFromSlug(slug)

  return jobs.map((job) => {
    const locationName =
      job.location && job.location.name ? job.location.name : 'Unknown'

    const postedAt = job.updated_at || job.created_at || null

    return {
      // This id is only used as a raw external identifier; ingest will build its own stable Job.id
      id: job.id,
      externalId: String(job.id),

      title: job.title || 'Unknown role',
      company: companyLabel,

      // Text version of location for normalizeLocation
      locationText: locationName,
      location: locationName,

      // full HTML description; ingestFromBoard will use this as descriptionHtml
      descriptionHtml: job.content || null,

      url: job.absolute_url || null,
      applyUrl: job.absolute_url || null,

      postedAt,

      greenhouseSlug: slug,
      greenhouseJobId: job.id,
      greenhouseLocation: job.location,
      greenhouseMetadata: job.metadata,
      greenhouseInternalJobId: job.internal_job_id,
    }
  })
}

/**
 * Main Greenhouse board scraper entrypoint.
 * Scrapes ALL companies with atsProvider='greenhouse' using their `slug`
 * as the Greenhouse board slug.
 */
export default async function scrapeGreenhouse() {
  const companies = await prisma.company.findMany({
    where: {
      atsProvider: 'greenhouse',
    },
    select: {
      slug: true,
    },
  })

  const companySlugs = companies.map((c) => c.slug)

  console.log(
    `🔍 Scraping Greenhouse ATS boards — ${companySlugs.length} companies`,
  )

  const allJobs: any[] = []

  const results = await Promise.allSettled(
    companySlugs.map(async (slug) => {
      const jobs = await fetchGreenhouseJobsForCompany(slug)
      console.log(`  🏢 ${slug}: ${jobs.length} jobs`)
      return jobs
    }),
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allJobs.push(...result.value)
    } else {
      console.error(`❌ Greenhouse fetch failed:`, result.reason)
    }
  }

  console.log(`Greenhouse: ${allJobs.length} raw jobs collected`)
  return allJobs
}
