// app/remote/companies/page.tsx
//
// "Remote companies hiring $100k+ roles": every company with an indexable company page that has open remote jobs
// publishing six-figure pay, most remote jobs first. Asked for by the owner (2026-11-09), modelled on the remote-company
// directories of remote100k.com and others, with live counts from our own jobs (lib/jobs/remoteCompanies.ts).
import type { Metadata } from 'next'
import { keywordsFor } from '@/lib/seo/keywordMap'
import Link from '@/components/ui/Link'
import { unstable_rethrow } from 'next/navigation'

import { CompanySearch } from '@/components/companies/CompanySearch'
import { Faq, JobRows, LinkChips, ListingHeader, ListingPage, ListingSection, Prose } from '@/components/listing/ListingParts'
import { loadRemoteCompaniesDirectory } from '@/lib/jobs/remoteCompanies'
import { buildRuntimeFallbackMetadata, logRuntimeFallback, skipPrerenderWhileBuilding } from '@/lib/runtime/fallback'
import { MIN_COMPANY_INDEXABLE_JOBS } from '@/lib/seo/indexabilityGates'
import { buildDescription, buildListingTitle } from '@/lib/seo/metaText'
import { SITE_NAME, defaultOgImages, getSiteUrl } from '@/lib/seo/site'

export const revalidate = 600

const SITE_URL = getSiteUrl()
const PATH = '/remote/companies'
const HEADING = 'Remote companies hiring $100k+ roles'

function describe(companies: number, jobs: number): string {
  if (companies === 0) return 'Companies hiring remotely for six-figure roles, with published salaries and links to apply.'
  return buildDescription(
    'Companies hiring remotely for $100k+ roles that publish their pay.',
    [['Salary shown upfront, with direct links to apply.', 'Salary shown upfront.']],
    `Updated daily on ${SITE_NAME}: ${companies.toLocaleString()} companies, ${jobs.toLocaleString()} remote jobs.`,
  )
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { companies, totalRemoteJobs } = await loadRemoteCompaniesDirectory()
    const title = buildListingTitle({ topic: 'Remote Companies', qualifier: 'Hiring $100k+ Roles' })
    const description = describe(companies.length, totalRemoteJobs)
    return {
      title,
      description,
      keywords: keywordsFor('remoteCompanies'),
      alternates: { canonical: `${SITE_URL}${PATH}` },
      robots: { index: true, follow: true },
      openGraph: { images: defaultOgImages(), title, description, url: `${SITE_URL}${PATH}`, siteName: SITE_NAME, type: 'website' },
      twitter: { card: 'summary_large_image', title, description },
    }
  } catch {
    return buildRuntimeFallbackMetadata({
      canonicalPath: PATH,
      title: `Remote companies temporarily unavailable | ${SITE_NAME}`,
      description: 'The remote companies directory is temporarily unavailable while the production database reconnects.',
    })
  }
}

export default async function RemoteCompaniesPage() {
  try {
    const { companies, totalRemoteJobs } = await loadRemoteCompaniesDirectory()
    const top = companies.slice(0, 5)
    const topNames = top.map((c) => c.name).join(', ')

    const faqItems = [
      {
        question: 'Which companies hire remotely for $100k+ roles?',
        answer:
          companies.length > 0
            ? `Right now ${companies.length.toLocaleString()} companies have open remote jobs that publish a six-figure salary. The most remote openings are at ${topNames}.`
            : 'Companies appear here once they have open remote jobs that publish a six-figure salary.',
      },
      {
        question: 'How does a company get on this list?',
        answer: `It needs a company page on ${SITE_NAME} (at least ${MIN_COMPANY_INDEXABLE_JOBS} open jobs with a published salary of $100k+, or the local equivalent such as £75k+ or €80k+) and at least one of those jobs open to remote work.`,
      },
      {
        question: 'What counts as a remote job?',
        answer:
          'A job the employer or job board marks as remote in its structured data. Hybrid and on-site jobs are not counted, and a job is not counted as remote because its description mentions the word. Some remote jobs are limited to certain countries; each job page says where.',
      },
      {
        question: 'How often is this list updated?',
        answer: 'Jobs are refreshed every day. Closed jobs and jobs not seen for 7 days are removed, and the counts here follow within minutes.',
      },
    ]

    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Remote', item: `${SITE_URL}/remote` },
          { '@type': 'ListItem', position: 3, name: 'Companies', item: `${SITE_URL}${PATH}` },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: HEADING,
        description: describe(companies.length, totalRemoteJobs),
        url: `${SITE_URL}${PATH}`,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: HEADING,
        numberOfItems: companies.length,
        itemListElement: companies.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: { '@type': 'Organization', name: c.name, url: `${SITE_URL}/company/${c.slug}`, ...(c.logoUrl ? { logo: c.logoUrl } : {}) },
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
      },
    ]

    return (
      <ListingPage>
        {jsonLd.map((block) => (
          <script key={block['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
        ))}

        <ListingHeader
          breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Remote', href: '/remote' }, { label: 'Companies' }]}
          title={HEADING}
          summary={
            companies.length > 0 ? (
              <>
                <strong>{companies.length.toLocaleString()}</strong> companies with open remote jobs that publish a salary
                of $100k+ (or the local equivalent), <strong>{totalRemoteJobs.toLocaleString()}</strong> remote jobs
                between them. Most remote openings first.
              </>
            ) : (
              'Companies with open remote six-figure jobs will appear here.'
            )
          }
        />

        {companies.length === 0 ? (
          <JobRows
            jobs={[]}
            empty={{
              title: 'No remote companies yet.',
              body: 'Companies appear here once they have an open remote job above the six-figure threshold.',
              href: '/remote',
              hrefLabel: 'Browse remote jobs',
            }}
          />
        ) : (
          <>
            <CompanySearch companies={companies} noun="remote job" />

            <ListingSection title="About this list">
              <Prose>
                <p>
                  Every company here has open remote roles on {SITE_NAME} that publish their pay, at or above the
                  six-figure line for their currency. Each company page lists all of its current six-figure openings,
                  remote and on-site, with the published range and a link to apply. To browse the jobs themselves, see{' '}
                  <Link href="/remote">all remote $100k+ jobs</Link>; for every employer, remote or not, see the{' '}
                  <Link href="/companies">full companies directory</Link>.
                </p>
              </Prose>
              {top.length > 0 ? (
                <LinkChips
                  label="Most remote openings right now"
                  items={top.map((c) => ({ label: String(c.name), href: `/company/${c.slug}`, count: c._count.jobs }))}
                />
              ) : null}
            </ListingSection>

            <ListingSection title="Questions about remote companies">
              <Faq items={faqItems} />
            </ListingSection>
          </>
        )}
      </ListingPage>
    )
  } catch (error) {
    unstable_rethrow(error)
    logRuntimeFallback('remote-companies.page', error)
    await skipPrerenderWhileBuilding()
    return (
      <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-14 pt-10">
        <h1 className="text-4xl font-normal tracking-[-0.035em] text-foreground">{HEADING}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The list is temporarily unavailable while the production database reconnects.{' '}
          <Link href="/remote">Browse remote jobs</Link>.
        </p>
      </main>
    )
  }
}
