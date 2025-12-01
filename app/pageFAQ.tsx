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
      a: 'We scrape daily, expire stale roles, and prioritize the newest high-paying openings.',
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
