import Link from 'next/link'

type FallbackLink = {
  href: string
  label: string
  primary?: boolean
}

type FallbackCard = {
  href: string
  title: string
  description: string
}

type DataUnavailablePageProps = {
  eyebrow: string
  title: string
  description: string
  links: FallbackLink[]
  cards?: FallbackCard[]
}

export function DataUnavailablePage({
  eyebrow,
  title,
  description,
  links,
  cards = [],
}: DataUnavailablePageProps) {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-14 pt-10">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl shadow-slate-950/40">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-50">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">{description}</p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {links.map((link) => (
            <Link
              key={`${link.href}:${link.label}`}
              href={link.href}
              className={
                link.primary
                  ? 'rounded-full bg-emerald-400 px-5 py-2 font-semibold text-slate-950'
                  : 'rounded-full border border-slate-700 px-5 py-2 text-slate-100'
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        {cards.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-100 transition hover:border-slate-600"
              >
                <div className="font-semibold">{card.title}</div>
                <p className="mt-2 text-xs text-slate-400">{card.description}</p>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}
