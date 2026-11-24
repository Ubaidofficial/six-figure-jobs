// Admin: live jobs that likely show something wrong (lib/admin/reviewQueue.ts), to fix or expire.
import { countReviewQueue, loadReviewIds, titleProblems, type ReviewKind } from '../../../../lib/admin/reviewQueue'
import { buildJobSlugHref } from '../../../../lib/jobs/jobSlug'
import { buildSalaryText } from '../../../../lib/jobs/salary'
import { prisma } from '../../../../lib/prisma'
import { PageHead, Tabs, s } from '../ui'
import ReviewTable, { type ReviewRow } from './ReviewTable'
import { requireAdmin } from '../requireAdmin'

export const dynamic = 'force-dynamic'

const LIMIT = 100

export default async function ReviewPage({ searchParams }: { searchParams?: Promise<{ kind?: string }> }) {
  await requireAdmin()
  const kind: ReviewKind = (await searchParams)?.kind === 'titles' ? 'titles' : 'pay'
  const [counts, ids] = await Promise.all([countReviewQueue(), loadReviewIds(kind, LIMIT)])
  const jobs = await prisma.job.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, shortId: true, title: true, company: true, source: true, locationRaw: true, postedAt: true, createdAt: true,
      minAnnual: true, maxAnnual: true, currency: true, salaryMin: true, salaryMax: true, salaryCurrency: true,
      salaryPeriod: true, applyUrl: true,
    },
  })
  const byId = new Map(jobs.map((j) => [j.id, j]))
  const rows: ReviewRow[] = ids
    .map((id) => byId.get(id))
    .filter((j): j is NonNullable<typeof j> => Boolean(j))
    .map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.locationRaw,
      source: j.source.replace(/^board:/, ''),
      posted: (j.postedAt ?? j.createdAt).toISOString().slice(0, 10),
      pay: buildSalaryText(j as Parameters<typeof buildSalaryText>[0]),
      href: buildJobSlugHref(j),
      applyUrl: j.applyUrl,
      reasons: kind === 'pay' ? ['pay over $600k a year'] : titleProblems(j.title),
    }))

  return (
    <>
      <PageHead
        title="Review"
        lede={
          kind === 'pay'
            ? 'Live jobs whose yearly pay is over $600k: real for some roles, a misread for others (a monthly figure taken as yearly, a total with equity). Check the employer page, then confirm, fix or expire.'
            : 'Live jobs whose title has “---” separators, pay written into it, or more than 110 characters. They show like that on the site and in Google. Editing a title changes the page address; the old address redirects.'
        }
      />
      <div className={s.toolbar}>
        <Tabs
          current={kind}
          items={[
            { label: 'Pay over $600k', value: 'pay', href: '/ubaid93/review', count: counts.pay },
            { label: 'Odd titles', value: 'titles', href: '/ubaid93/review?kind=titles', count: counts.titles },
          ]}
        />
      </div>
      <div className={s.panel}>
        <ReviewTable rows={rows} kind={kind} />
        {counts[kind] > LIMIT ? (
          <div className={s.pager}>
            <span>
              Showing {LIMIT} of {counts[kind].toLocaleString()}. Fixed or expired jobs leave the list, and the next ones come in.
            </span>
          </div>
        ) : null}
      </div>
    </>
  )
}
