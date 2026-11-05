// app/pageFAQ.tsx
// Home page FAQ component (exported for reuse/testing)

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

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        FAQs about Six Figure Jobs
      </h2>
      <div className="space-y-3 text-sm text-muted-foreground">
        {items.map((item) => (
          <div key={item.q}>
            <p className="font-semibold text-foreground">{item.q}</p>
            <p className="text-muted-foreground">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
