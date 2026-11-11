// app/high-paying-jobs/page.tsx
//
// "High-paying jobs, ranked by real pay": roles ranked by the median of their live listings, and the highest-paying
// open jobs right now. Targets "high paying jobs" (about 201,000 US searches a month per DataForSEO, 2026-11-09), a
// search mostly answered by listicles; this page answers it from live published salaries (lib/jobs/highPayingJobs.ts).
import type { Metadata } from 'next'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'

import { Faq, JobRows, LinkChips, ListingHeader, ListingPage, ListingSection, Prose } from '@/components/listing/ListingParts'
import { HIGH_PAYING_MIN_ROLES_TO_INDEX, highPayingFaq, loadHighPayingJobs, MIN_LISTINGS } from '@/lib/jobs/highPayingJobs'
import { buildRuntimeFallbackMetadata, logRuntimeFallback, skipPrerenderWhileBuilding } from '@/lib/runtime/fallback'
import { fitTitle } from '@/lib/seo/metaText'
import { SITE_NAME, defaultOgImages, getSiteUrl } from '@/lib/seo/site'

export const revalidate = 1800

const SITE_URL = getSiteUrl()
const PATH = '/high-paying-jobs'
const HEADING = 'High-paying jobs, ranked by real pay'

const money = (v: number) => `$${Math.round(v / 1000)}k`

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { roles, listings } = await loadHighPayingJobs()
    const title =
      roles.length > 0
        ? fitTitle([
            `High-Paying Jobs: ${roles.length} Highest-Paying Roles | ${SITE_NAME}`,
            `High-Paying Jobs: ${roles.length} Highest-Paying Roles by Real Pay`,
            `High-Paying Jobs: ${roles.length} Highest-Paying Roles`,
          ])
        : fitTitle([`High-Paying Jobs Ranked by Real Pay | ${SITE_NAME}`, 'High-Paying Jobs Ranked by Real Pay'])
    const description =
      roles.length > 0
        ? `High-paying jobs: the ${roles.length} highest-paying roles, ranked by median salary from ${listings.toLocaleString('en-US')} live listings with published pay. ${roles[0].label} leads at ${money(roles[0].median)}.`
        : 'High-paying jobs ranked by the median salary of live listings that publish their pay.'
    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}${PATH}` },
      robots: roles.length >= HIGH_PAYING_MIN_ROLES_TO_INDEX ? { index: true, follow: true } : { index: false, follow: true },
      openGraph: { images: defaultOgImages(), title, description, url: `${SITE_URL}${PATH}`, siteName: SITE_NAME, type: 'website' },
      twitter: { card: 'summary_large_image', title, description },
    }
  } catch {
    return buildRuntimeFallbackMetadata({
      canonicalPath: PATH,
      title: `High-paying jobs temporarily unavailable | ${SITE_NAME}`,
      description: 'The high-paying jobs ranking is temporarily unavailable while the production database reconnects.',
    })
  }
}

export default async function HighPayingJobsPage() {
  try {
    const { roles, topJobs, listings } = await loadHighPayingJobs()
    const faq = highPayingFaq(roles, listings)
    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'High-paying jobs', item: `${SITE_URL}${PATH}` },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Highest-paying roles by median salary',
        numberOfItems: roles.length,
        itemListElement: roles.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.label, url: `${SITE_URL}/jobs/${r.slug}` })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
      },
    ]

    return (
      <ListingPage>
        {jsonLd.map((block) => (
          <script key={block['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
        ))}

        <ListingHeader
          breadcrumb={[{ label: 'Home', href: '/' }, { label: 'High-paying jobs' }]}
          title={HEADING}
          summary={
            roles.length > 0 ? (
              <>
                <strong>{roles.length}</strong> roles ranked by the median salary of{' '}
                <strong>{listings.toLocaleString('en-US')}</strong> live US-dollar listings that publish their pay.
                Right now {roles[0].label} pays the most, at a median of <strong>{money(roles[0].median)}</strong>.
              </>
            ) : (
              'Roles ranked by the median salary of live listings that publish their pay.'
            )
          }
        />

        {roles.length > 0 ? (
          <ListingSection title="Highest-paying roles">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Roles ranked by median salary in US dollars, from live listings that publish their pay</caption>
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">#</th>
                    <th scope="col" className="px-4 py-3 font-medium">Role</th>
                    <th scope="col" className="px-4 py-3 font-medium">Median</th>
                    <th scope="col" className="px-4 py-3 font-medium">Middle half</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Open jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r, i) => (
                    <tr key={r.slug} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <th scope="row" className="px-4 py-3 font-medium text-foreground">
                        <Link href={`/jobs/${r.slug}`} className="hover:underline underline-offset-4">
                          {r.label}
                        </Link>
                      </th>
                      <td className="px-4 py-3 font-semibold text-primary">{money(r.median)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {money(r.p25)}–{money(r.p75)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{r.listings.toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListingSection>
        ) : null}

        {topJobs.length > 0 ? (
          <ListingSection title="Highest-paying open jobs right now">
            <JobRows jobs={topJobs} />
            <p style={{ marginTop: 12 }}>
              <Link href="/jobs/300k-plus" className="text-primary hover:underline underline-offset-4">
                See all $300k+ jobs →
              </Link>
            </p>
          </ListingSection>
        ) : null}

        <ListingSection title="How this ranking works">
          <Prose>
            <p>
              Most lists of high-paying jobs quote national averages. This one is built from the jobs open on {SITE_NAME}{' '}
              today: every listing publishes its salary, each counts once at the midpoint of its range, and a role is
              ranked only when at least {MIN_LISTINGS} listings back its median. Senior, staff and principal titles count
              toward their role. Because the listings change every day, so does the ranking.
            </p>
          </Prose>
          <LinkChips
            label="Related"
            items={[
              { label: 'Salary guides by role', href: '/salary' },
              { label: '$200k+ jobs', href: '/jobs/200k-plus' },
              { label: 'Remote $100k+ jobs', href: '/remote' },
              { label: 'Six-figure jobs without a degree', href: '/jobs/no-degree' },
            ]}
          />
        </ListingSection>

        <ListingSection title="Questions about high-paying jobs">
          <Faq items={faq} />
        </ListingSection>
      </ListingPage>
    )
  } catch (error) {
    unstable_rethrow(error)
    logRuntimeFallback('high-paying-jobs.page', error)
    await skipPrerenderWhileBuilding()
    return (
      <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-14 pt-10">
        <h1 className="text-4xl font-normal tracking-[-0.035em] text-foreground">{HEADING}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The ranking is temporarily unavailable while the production database reconnects. <Link href="/jobs">Browse all jobs</Link>.
        </p>
      </main>
    )
  }
}
