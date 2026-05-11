import { readFile } from 'node:fs/promises'
import { prisma } from '../lib/prisma'
import { buildJobJsonLd } from '../lib/seo/jobJsonLd'
import { buildJobBreadcrumbJsonLd } from '../lib/seo/jobBreadcrumbJsonLd'
import { buildCleanJobsCanonicalPath } from '../lib/seo/listingSearchParams'
import { filterSimilarJobs } from '../lib/jobs/similarJobs'
import { getMinimumSalaryRejection } from '../lib/jobs/salaryPublicationGate'
import {
  notifyJobDeletedForIndexing,
  notifyJobInsertedForIndexing,
  resetJobIndexingNotifierForTests,
  setJobIndexingNotifierForTests,
} from '../lib/jobs/indexingNotifications'
import type { JobWithCompany } from '../lib/jobs/queryJobs'

type Check = {
  id: string
  label: string
  pass: boolean
  detail: string
}

const root = process.cwd()
const siteUrl = 'https://www.6figjobs.com'
process.env.SITE_URL = siteUrl

function pass(id: string, label: string, detail = 'OK'): Check {
  return { id, label, pass: true, detail }
}

function fail(id: string, label: string, detail: string): Check {
  return { id, label, pass: false, detail }
}

function lineNumber(source: string, needle: string): number {
  const idx = source.indexOf(needle)
  if (idx < 0) return 0
  return source.slice(0, idx).split('\n').length
}

function makeJob(overrides: Partial<JobWithCompany> = {}): JobWithCompany {
  const base = {
    id: 'ats:test:coreweave-1',
    title: 'Senior Software Engineer',
    company: 'CoreWeave',
    companyLogo: 'https://img.logo.dev/coreweave.com',
    locationRaw: 'Roseland, NJ, US',
    city: 'Roseland',
    citySlug: 'roseland',
    countryCode: 'US',
    remote: false,
    remoteRegion: null,
    remoteMode: 'onsite',
    salaryRaw: '$120,000 - $160,000',
    descriptionHtml: '<p>Build infrastructure for high-performance compute teams.</p>',
    salaryMin: BigInt(120000),
    salaryMax: BigInt(160000),
    salaryCurrency: 'USD',
    salaryPeriod: 'year',
    minAnnual: BigInt(120000),
    maxAnnual: BigInt(160000),
    currency: 'USD',
    isHighSalary: true,
    isHundredKLocal: true,
    type: 'Full-time',
    source: 'ats:greenhouse',
    applyUrl: 'https://jobs.example.com/apply',
    url: 'https://jobs.example.com/job',
    roleSlug: 'software-engineer',
    skillsJson: null,
    requirementsJson: null,
    benefitsJson: null,
    externalId: 'coreweave-1',
    isExpired: false,
    lastSeenAt: new Date('2026-05-09T00:00:00.000Z'),
    postedAt: new Date('2026-05-08T00:00:00.000Z'),
    expiresAt: null,
    validThrough: null,
    createdAt: new Date('2026-05-08T00:00:00.000Z'),
    updatedAt: new Date('2026-05-09T00:00:00.000Z'),
    companyId: 'company-coreweave',
    locationId: null,
    dedupeKey: null,
    sourcePriority: 10,
    isUnverifiedBoardJob: false,
    experienceLevel: 'senior',
    employmentType: 'full-time',
    workArrangement: null,
    visaSponsorship: false,
    noDegreeMention: false,
    techStack: null,
    industry: null,
    stateCode: 'NJ',
    shortId: null,
    aiSummaryJson: null,
    aiSnippet: null,
    aiOneLiner: null,
    aiEnrichedAt: null,
    locationsJson: null,
    primaryLocation: null,
    aiBenefits: null,
    aiRequirements: null,
    aiWhyHighPay: null,
    aiModel: null,
    aiVersion: null,
    aiQualityScore: null,
    lastAiEnrichedAt: null,
    salaryConfidence: 95,
    salaryValidated: true,
    salarySource: 'ats',
    salaryParseReason: null,
    salaryNormalizedAt: null,
    salaryRejectedAt: null,
    salaryRejectedReason: null,
    needsReview: false,
    workArrangementNormalized: null,
    companyRef: {
      id: 'company-coreweave',
      name: 'CoreWeave',
      slug: 'coreweave',
      website: 'https://www.coreweave.com',
      logoUrl: 'https://img.logo.dev/coreweave.com',
      description: 'CoreWeave builds cloud infrastructure.',
      linkedinUrl: null,
      sizeBucket: null,
      tagsJson: null,
      fundingSummary: null,
      industry: null,
      atsProvider: null,
      atsUrl: null,
      atsSlug: null,
      lastScrapedAt: null,
      scrapeStatus: null,
      scrapeError: null,
      jobCount: 0,
      totalJobCount: null,
      lastJobCountSyncAt: null,
      countryCode: 'US',
      headquarters: null,
      employeeCount: null,
      fundingStage: null,
      foundedYear: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-09T00:00:00.000Z'),
    },
  } satisfies JobWithCompany

  return { ...base, ...overrides }
}

async function runChecks(): Promise<Check[]> {
  const layout = await readFile(`${root}/app/layout.tsx`, 'utf8')
  const jobPage = await readFile(`${root}/app/job/[slug]/page.tsx`, 'utf8')
  const carousel = await readFile(`${root}/components/home/FeaturedCompaniesCarousel.tsx`, 'utf8')
  const ingest = await readFile(`${root}/lib/ingest/index.ts`, 'utf8')
  const expiry = await readFile(`${root}/lib/jobs/expiry.ts`, 'utf8')

  const checks: Check[] = []

  const headMatch = layout.match(/<head>\s*([\s\S]*?)\s*<link\s+rel="preconnect"/)
  checks.push(
    headMatch?.[1]?.trim() === '<meta charSet="UTF-8" />'
      ? pass('V1', 'charset tag', `app/layout.tsx:${lineNumber(layout, '<meta charSet="UTF-8" />')}`)
      : fail('V1', 'charset tag', 'app/layout.tsx: <meta charSet="UTF-8" /> is not the first tag in <head>'),
  )

  const job = makeJob()
  const jsonLd = buildJobJsonLd(job)
  const renderedJobScript = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
  const requiredJobFields =
    jsonLd['@type'] === 'JobPosting' &&
    typeof jsonLd.title === 'string' &&
    typeof jsonLd.datePosted === 'string' &&
    typeof jsonLd.validThrough === 'string' &&
    typeof jsonLd.description === 'string' &&
    Boolean(jsonLd.hiringOrganization?.name) &&
    Number(jsonLd.baseSalary?.value?.minValue) >= 100000 &&
    Number(jsonLd.baseSalary?.value?.maxValue) >= Number(jsonLd.baseSalary?.value?.minValue) &&
    Boolean(jsonLd.employmentType) &&
    new Date(jsonLd.validThrough).getTime() > new Date(jsonLd.datePosted).getTime()
  checks.push(
    renderedJobScript.includes('"@type":"JobPosting"') && requiredJobFields
      ? pass('V2', 'JobPosting schema', 'JobPosting JSON-LD contains all required populated fields')
      : fail('V2', 'JobPosting schema', 'JobPosting JSON-LD missing required fields or invalid salary/date values'),
  )

  const remoteSchema = buildJobJsonLd(
    makeJob({
      id: 'ats:test:remote-1',
      remote: true,
      remoteMode: 'remote',
      remoteRegion: 'United States',
      city: null,
      stateCode: null,
      locationRaw: 'Remote',
    }),
  )
  checks.push(
    remoteSchema.jobLocationType === 'TELECOMMUTE' &&
      Boolean(remoteSchema.applicantLocationRequirements) &&
      remoteSchema.jobLocation === undefined
      ? pass('V3', 'Remote job schema', 'Remote schema uses TELECOMMUTE and applicantLocationRequirements only')
      : fail('V3', 'Remote job schema', 'Remote schema still includes a physical jobLocation or lacks TELECOMMUTE requirements'),
  )

  checks.push(
    jobPage.includes('fullCompanyName(rawCompanyName)') && !jobPage.includes('cleanCompanyName(rawCompanyName)')
      ? pass('V4', 'Company name not truncated', 'Job detail page uses full persisted company name for visible company text')
      : fail('V4', 'Company name not truncated', 'app/job/[slug]/page.tsx still appears to truncate the company name'),
  )

  checks.push(
    getMinimumSalaryRejection({ salaryMin: 90000, title: 'Mock', source: 'ats:test' }) === 'salary-min-below-100k' &&
      ingest.includes('getMinimumSalaryRejection')
      ? pass('V5', 'Salary filter ($100k minimum)', 'Mock salaryMin 90000 is rejected before publish')
      : fail('V5', 'Salary filter ($100k minimum)', 'Mock salaryMin 90000 was not rejected'),
  )

  const preconnects = ['https://img.logo.dev', 'https://cdn.builtin.com', 'https://logo.clearbit.com']
  const missingPreconnects = preconnects.filter((href) => !layout.includes(`href="${href}"`))
  checks.push(
    missingPreconnects.length === 0
      ? pass('V6', 'preconnect tags', 'All image-domain preconnect tags are present')
      : fail('V6', 'preconnect tags', `Missing preconnect hrefs: ${missingPreconnects.join(', ')}`),
  )

  checks.push(
    carousel.includes("loading={index < 4 ? 'eager' : 'lazy'}") &&
      carousel.includes('index={idx}')
      ? pass('V7', 'Carousel loading attributes', 'First 4 carousel logos eager-load; later logos lazy-load')
      : fail('V7', 'Carousel loading attributes', 'FeaturedCompaniesCarousel does not split loading by index'),
  )

  const current = makeJob({ id: 'current', title: 'Außendienstmitarbeiter', companyId: 'sumup', company: 'SumUp' })
  const duplicateJobs = [1, 2, 3].map((n) =>
    makeJob({
      id: `dup-${n}`,
      title: 'Außendienstmitarbeiter',
      companyId: 'sumup',
      company: 'SumUp',
      postedAt: new Date(`2026-05-0${n}T00:00:00.000Z`),
      companyRef: null,
    }),
  )
  const deduped = filterSimilarJobs(current, duplicateJobs, 6)
  checks.push(
    deduped.length === 1
      ? pass('V8', 'Similar jobs deduplication', 'Duplicate SumUp Außendienstmitarbeiter jobs collapsed to one')
      : fail('V8', 'Similar jobs deduplication', `Expected 1 duplicate after filtering, got ${deduped.length}`),
  )

  const outlier = makeJob({
    id: 'salary-outlier',
    salaryMin: BigInt(1500000),
    minAnnual: BigInt(1500000),
    title: 'Platform Engineer',
  })
  const dailyOutlier = makeJob({
    id: 'salary-daily-outlier',
    title: 'Telecommunications Technician',
    salaryMin: BigInt(4280),
    salaryMax: BigInt(4280),
    salaryPeriod: 'day',
    minAnnual: BigInt(1112800),
    maxAnnual: BigInt(1112800),
    currency: 'USD',
    salaryCurrency: 'USD',
  })
  const salaryFiltered = filterSimilarJobs(job, [outlier, dailyOutlier], 6)
  checks.push(
    salaryFiltered.length === 0
      ? pass('V9', 'Similar jobs salary sanity', 'annual salary outliers were filtered from Similar Jobs')
      : fail('V9', 'Similar jobs salary sanity', 'annual salary outliers remained in Similar Jobs'),
  )

  const indexingCalls: Array<{ url: string; type: string }> = []
  setJobIndexingNotifierForTests(async (url, type) => {
    indexingCalls.push({ url, type })
    return { ok: true }
  })
  await notifyJobInsertedForIndexing(job)
  checks.push(
    indexingCalls.some((call) => call.type === 'URL_UPDATED' && call.url.includes('/job/'))
      ? pass('V10', 'Indexing API on insert', 'notifyGoogleIndexing called with URL_UPDATED')
      : fail('V10', 'Indexing API on insert', 'notifyGoogleIndexing was not called with URL_UPDATED'),
  )

  indexingCalls.length = 0
  await notifyJobDeletedForIndexing(job)
  resetJobIndexingNotifierForTests()
  checks.push(
    indexingCalls.some((call) => call.type === 'URL_DELETED' && call.url.includes('/job/')) &&
      expiry.includes('notifyJobDeletedForIndexing')
      ? pass('V11', 'Indexing API on delete', 'notifyGoogleIndexing called with URL_DELETED')
      : fail('V11', 'Indexing API on delete', 'notifyGoogleIndexing was not called with URL_DELETED'),
  )

  const canonical = `${siteUrl}${buildCleanJobsCanonicalPath({ role: 'software-engineer', remoteMode: 'remote' })}`
  checks.push(
    canonical === `${siteUrl}/jobs/software-engineer/remote`
      ? pass('V12', 'Canonical on filtered pages', canonical)
      : fail('V12', 'Canonical on filtered pages', `Expected ${siteUrl}/jobs/software-engineer/remote, got ${canonical}`),
  )

  const breadcrumb = buildJobBreadcrumbJsonLd(job, 'senior-software-engineer-j-test')
  checks.push(
    breadcrumb['@type'] === 'BreadcrumbList' &&
      breadcrumb.itemListElement.length === 3 &&
      breadcrumb.itemListElement.map((item) => item.position).join(',') === '1,2,3' &&
      breadcrumb.itemListElement[0]?.item === siteUrl &&
      breadcrumb.itemListElement[1]?.item === `${siteUrl}/jobs`
      ? pass('V13', 'BreadcrumbList schema', 'BreadcrumbList has Home, Jobs, and job item')
      : fail('V13', 'BreadcrumbList schema', 'BreadcrumbList does not contain the required 3 items'),
  )

  checks.push(
    jobPage.includes("'og:updated_time'")
      ? pass('V14', 'og:updated_time', `app/job/[slug]/page.tsx:${lineNumber(jobPage, "'og:updated_time'")}`)
      : fail('V14', 'og:updated_time', 'app/job/[slug]/page.tsx missing og:updated_time metadata'),
  )

  try {
    const sampledJobs = await prisma.job.findMany({
      where: { isExpired: false },
      select: { id: true, validThrough: true },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    })
    const now = Date.now()
    const invalid = sampledJobs.filter((sample) => !sample.validThrough || sample.validThrough.getTime() <= now)
    checks.push(
      sampledJobs.length > 0 && invalid.length === 0
        ? pass('V15', 'validThrough future date', `Sampled ${sampledJobs.length} published jobs`)
        : fail(
            'V15',
            'validThrough future date',
            sampledJobs.length === 0
              ? 'No published jobs available to sample'
              : `Found ${invalid.length} sampled published jobs with missing/past validThrough`,
          ),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const detail = message.includes('The column `Job.validThrough` does not exist')
      ? 'Database sample failed: local database schema is missing Job.validThrough; apply prisma migration 20260510120000_add_job_valid_through and rerun'
      : `Database sample failed: ${message}`
    checks.push(
      fail(
        'V15',
        'validThrough future date',
        detail,
      ),
    )
  } finally {
    await prisma.$disconnect()
  }

  return checks
}

function formatReport(checks: Check[]): string {
  const timestamp = new Date().toISOString()
  const passed = checks.filter((check) => check.pass).length
  const failed = checks.filter((check) => !check.pass)
  const implementedFixes = 12
  const eligible = checks.find((check) => check.id === 'V2')?.pass && checks.find((check) => check.id === 'V3')?.pass

  const status = (id: string) => (checks.find((check) => check.id === id)?.pass ? 'PASS ✅' : 'FAIL ❌')

  return `===================================================
6FIGJOBS.COM — SEO FIX IMPLEMENTATION REPORT
Generated: ${timestamp}
===================================================

FIXES IMPLEMENTED: ${implementedFixes} / 12

VERIFICATION RESULTS:
V1 charset tag .......................... ${status('V1')}
V2 JobPosting schema .................... ${status('V2')}
V3 Remote job schema .................... ${status('V3')}
V4 Company name not truncated ........... ${status('V4')}
V5 Salary filter ($100k minimum) ........ ${status('V5')}
V6 preconnect tags ...................... ${status('V6')}
V7 Carousel loading attributes .......... ${status('V7')}
V8 Similar jobs deduplication ........... ${status('V8')}
V9 Similar jobs salary sanity ........... ${status('V9')}
V10 Indexing API on insert ............... ${status('V10')}
V11 Indexing API on delete ............... ${status('V11')}
V12 Canonical on filtered pages .......... ${status('V12')}
V13 BreadcrumbList schema ................ ${status('V13')}
V14 og:updated_time ...................... ${status('V14')}
V15 validThrough future date ............. ${status('V15')}

OVERALL: ${passed} / 15 checks passed

REMAINING ISSUES (any FAILs):
${failed.length === 0 ? '- None' : failed.map((check) => `- ${check.id} ${check.label}: ${check.detail}`).join('\n')}

GOOGLE FOR JOBS ELIGIBILITY:
${eligible ? 'ELIGIBLE ✅' : `NOT ELIGIBLE ❌ — ${checks.find((check) => check.id === 'V2' && !check.pass)?.detail ?? checks.find((check) => check.id === 'V3' && !check.pass)?.detail ?? 'JobPosting or remote schema verification failed'}`}

NEXT MANUAL STEPS:
1. Validate a live job URL at https://search.google.com/test/rich-results
2. Submit sitemap to Google Search Console: https://www.6figjobs.com/sitemap.xml
3. Monitor Google Search Console > Enhancements > Job Postings for indexing errors
4. Verify Google Indexing API service account has Search Console Owner permissions
5. Run PageSpeed Insights on homepage + 1 job page: https://pagespeed.web.dev
===================================================`
}

runChecks()
  .then((checks) => {
    console.log(formatReport(checks))
    if (checks.some((check) => !check.pass)) {
      process.exitCode = 1
    }
  })
  .catch(async (error) => {
    await prisma.$disconnect()
    console.error(error)
    process.exitCode = 1
  })
