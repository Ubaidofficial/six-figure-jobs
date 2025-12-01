// app/pageFAQ.tsx
// Home page FAQ component (exported for reuse/testing)

export function HomeFAQ() {
  const items = [
    {
      q: 'How do you ensure roles are $100k+?',
      a: 'We ingest ATS feeds and vetted boards, parse salary data, and apply local currency thresholds ($100k USD or equivalent) before publishing.',
    },
    {
      q: 'Do you include remote and hybrid jobs?',
      a: 'Yes. Every job is tagged as remote, hybrid, or on-site. Use filters or the remote pages to focus on flexible roles.',
    },
    {
      q: 'How fresh is the job data?',
      a: 'We refresh twice daily, expire stale roles, and prioritize the newest high-paying openings.',
    },
    {
      q: 'Can I find six-figure jobs without a degree?',
      a: 'Many six-figure roles value experience and portfolio over formal degrees—especially in software, product, data, design, and sales. Filter by role and location to see $100k+ jobs that fit your background.',
    },
    {
      q: 'How do I find $100k jobs near me?',
      a: 'Browse by country or city pages, or search by location on the homepage. We also show local-currency equivalents (CHF, GBP, EUR, CAD, AUD) to compare offers in your market.',
    },
  ]

  return (
    <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-50">
        FAQs about Six Figure Jobs
      </h2>
      <div className="space-y-3 text-sm text-slate-300">
        {items.map((item) => (
          <div key={item.q}>
            <p className="font-semibold text-slate-100">{item.q}</p>
            <p className="text-slate-300">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
