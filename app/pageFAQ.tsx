// app/pageFAQ.tsx
// Home page FAQ component (exported for reuse/testing)

import { SectionHeading } from '@/components/ui/SectionHeading'

export function HomeFAQ() {
  const items = [
    {
      q: 'How do you ensure roles are $100k+?',
      a: 'We ingest company career pages and job boards, parse salary data, and prioritize roles with validated high-salary signals, published compensation, seniority fit, and direct apply links before publishing.',
    },
    {
      q: 'Do you include remote and hybrid jobs?',
      a: 'Yes. Every job is tagged as remote, hybrid, or on-site. Use filters or the remote pages to focus on flexible roles.',
    },
    {
      q: 'How fresh is the job data?',
      a: 'Every listing shows when it was posted, and the newest high-paying openings are listed first.',
    },
    {
      q: 'Can I find six-figure jobs without a degree?',
      a: 'Many six-figure roles value experience and portfolio over formal degrees—especially in software, product, data, design, and sales. Filter by role and location to see $100k+ jobs that fit your background.',
    },
    {
      q: 'How do I find $100k jobs near me?',
      a: 'Browse by country or city pages, or search by location on the homepage. Country pages include currency-specific salary context, verified salary ranges where available, and fresh direct-apply roles.',
    },
  ]

  // An accordion: questions scan in one glance and each answer opens in place (it stays in the HTML for search engines).
  return (
    <section className="mt-12" aria-labelledby="home-faq-heading">
      <div className="mb-5">
        <SectionHeading id="home-faq-heading" eyebrow="FAQ" light="Questions" strong="people ask" />
      </div>
      <div className="panel-hairline divide-y divide-border overflow-hidden">
        {items.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold text-foreground hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
