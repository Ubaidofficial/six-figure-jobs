import { readFile } from 'node:fs/promises'

type Check = {
  id: string
  label: string
  pass: boolean
  detail: string
}

function ok(id: string, label: string, detail: string): Check {
  return { id, label, pass: true, detail }
}

function fail(id: string, label: string, detail: string): Check {
  return { id, label, pass: false, detail }
}

async function load(path: string): Promise<string> {
  return readFile(`${process.cwd()}/${path}`, 'utf8')
}

async function run(): Promise<Check[]> {
  const [
    home,
    jobsIndex,
    jobDetail,
    searchPage,
    robotsRoute,
    sitemapJobsRoute,
    indexabilityGates,
    blogIndex,
    blogPost,
    aboutPage,
    companyPage,
    salaryRolePage,
  ] = await Promise.all([
    load('app/page.tsx'),
    load('app/jobs/page.tsx'),
    load('app/job/[slug]/page.tsx'),
    load('app/search/page.tsx'),
    load('app/robots.txt/route.ts'),
    load('app/sitemap-jobs/[page]/route.ts'),
    load('lib/seo/indexabilityGates.ts'),
    load('app/blog/page.tsx'),
    load('app/blog/[slug]/page.tsx'),
    load('app/about/page.tsx'),
    load('app/company/[slug]/page.tsx'),
    load('app/salary/[role]/page.tsx'),
  ])

  const checks: Check[] = []

  checks.push(
    home.includes('urlTemplate: `${siteUrl}/search?q={search_term_string}`')
      ? ok('BP1', 'Homepage search schema', 'WebSite SearchAction points at /search')
      : fail('BP1', 'Homepage search schema', 'SearchAction does not point at the canonical /search route'),
  )

  checks.push(
    home.includes("'@type': 'WebSite'") && home.includes("'@type': 'Organization'")
      ? ok('BP2', 'Homepage structured data', 'Homepage emits WebSite and Organization schema')
      : fail('BP2', 'Homepage structured data', 'Homepage is missing WebSite or Organization schema'),
  )

  checks.push(
    jobDetail.includes('buildJobJsonLd(') &&
    jobDetail.includes('buildJobBreadcrumbJsonLd(') &&
    jobDetail.includes('const qualityGate = evaluateJobIndexability(job)') &&
    jobDetail.includes('robots: qualityGate.indexable')
      ? ok('BP3', 'Job detail SEO', 'Job pages use JobPosting schema, breadcrumbs, and indexability gating')
      : fail('BP3', 'Job detail SEO', 'Job detail page is missing schema or indexability gating'),
  )

  checks.push(
    searchPage.includes('robots: {') &&
    searchPage.includes('index: false') &&
    searchPage.includes('follow: true')
      ? ok('BP4', 'Search noindex', 'Internal search pages are noindex, follow')
      : fail('BP4', 'Search noindex', 'Search page metadata is not explicitly noindex'),
  )

  checks.push(
    robotsRoute.includes('Sitemap: ${SITE_URL}/sitemap.xml') &&
    robotsRoute.includes('Sitemap: ${SITE_URL}/sitemap-jobs.xml')
      ? ok('BP5', 'Robots + sitemap discovery', 'robots.txt advertises root and job sitemaps')
      : fail('BP5', 'Robots + sitemap discovery', 'robots.txt is missing one or more core sitemap entries'),
  )

  checks.push(
    sitemapJobsRoute.includes('buildIndexableJobStructureWhere()') &&
    sitemapJobsRoute.includes('evaluateJobIndexability(job).indexable')
      ? ok('BP6', 'Job sitemap quality gate', 'Job sitemap shards only emit structurally indexable jobs')
      : fail('BP6', 'Job sitemap quality gate', 'Job sitemap route is missing structural/indexability checks'),
  )

  checks.push(
    jobsIndex.includes('buildCleanJobsCanonicalPath(sp)') &&
    jobsIndex.includes('hasNonPaginationQueryParams(sp)') &&
    jobsIndex.includes('robots: noindexUtilityState ? { index: false, follow: true }')
      ? ok('BP7', 'Listing canonicalization', 'Jobs index canonicalizes filtered states and noindexes utility URLs')
      : fail('BP7', 'Listing canonicalization', 'Jobs index lacks canonical/noindex handling for filtered utility states'),
  )

  checks.push(
    indexabilityGates.includes('MIN_COMPANY_INDEXABLE_JOBS') &&
    indexabilityGates.includes('MIN_ROLE_FILTER_INDEXABLE_JOBS') &&
    indexabilityGates.includes('MIN_CITY_INDEXABLE_JOBS')
      ? ok('BP8', 'Thin-page thresholds', 'Shared indexability thresholds exist for thin page control')
      : fail('BP8', 'Thin-page thresholds', 'Shared thin-page thresholds are missing'),
  )

  checks.push(
    blogPost.includes("'@type': 'BlogPosting'") &&
    blogPost.includes("'@type': 'FAQPage'") &&
    blogPost.includes("'@type': 'BreadcrumbList'")
      ? ok('BP9', 'Blog post schema', 'Editorial posts emit BlogPosting, FAQPage, and BreadcrumbList schema')
      : fail('BP9', 'Blog post schema', 'Blog post page is missing one or more editorial schema types'),
  )

  checks.push(
    blogIndex.includes("'@type': 'CollectionPage'") &&
    blogIndex.includes("'@type': 'ItemList'") &&
    blogIndex.includes("href: '/jobs/software-engineer'")
      ? ok('BP10', 'Blog hub linking', 'Blog hub emits collection schema and links back into money pages')
      : fail('BP10', 'Blog hub linking', 'Blog hub is missing collection schema or internal links to job hubs'),
  )

  checks.push(
    aboutPage.includes("'@type': 'AboutPage'") &&
    aboutPage.includes("'@type': 'Organization'") &&
    aboutPage.includes("'@type': 'BreadcrumbList'")
      ? ok('BP11', 'Trust page schema', 'About page emits AboutPage, Organization, and breadcrumb schema')
      : fail('BP11', 'Trust page schema', 'About page trust/schema signals are incomplete'),
  )

  checks.push(
    companyPage.includes('buildOrganizationJsonLd(company)') &&
    companyPage.includes('buildCompanyJobsItemListJsonLd(company, qualifiedJobs)') &&
    companyPage.includes('buildCompanyFaqJsonLd(company, qualifiedJobs)')
      ? ok('BP12', 'Company page schema', 'Company pages emit organization, item list, and FAQ schema')
      : fail('BP12', 'Company page schema', 'Company pages are missing one or more schema blocks'),
  )

  checks.push(
    salaryRolePage.includes("'@type': 'Occupation'") &&
    salaryRolePage.includes("'@type': 'FAQPage'")
      ? ok('BP13', 'Salary page schema', 'Salary guides emit Occupation and FAQ schema')
      : fail('BP13', 'Salary page schema', 'Salary guide schema is incomplete'),
  )

  return checks
}

function report(checks: Check[]): string {
  const passed = checks.filter((check) => check.pass)
  const failed = checks.filter((check) => !check.pass)
  return [
    '===================================================',
    'JOB BOARD SEO BEST PRACTICES AUDIT',
    'Scope: Cavuno + Embarque technical/code-enforceable checks',
    '===================================================',
    ...checks.map((check) => `${check.id} ${check.pass ? 'PASS' : 'FAIL'}  ${check.label} — ${check.detail}`),
    '---------------------------------------------------',
    `Passed: ${passed.length}/${checks.length}`,
    failed.length > 0 ? `Failed: ${failed.map((check) => check.id).join(', ')}` : 'Failed: none',
    '===================================================',
  ].join('\n')
}

run()
  .then((checks) => {
    console.log(report(checks))
    if (checks.some((check) => !check.pass)) {
      process.exitCode = 1
    }
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
