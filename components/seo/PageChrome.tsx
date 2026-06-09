import type { ReactNode } from 'react'

export function PageHero({
  eyebrow,
  title,
  description,
  helper,
  actions,
  children,
}: {
  eyebrow?: string
  title: string
  description: ReactNode
  helper?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 text-2xl font-semibold text-slate-50">{title}</h1>
      <div className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
        {description}
      </div>
      {helper ? <div className="mt-3 text-xs text-slate-400">{helper}</div> : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  )
}

export function PageStatGrid({
  items,
}: {
  items: Array<{
    label: string
    value: ReactNode
    hint?: ReactNode
  }>
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
        >
          <div className="text-xs text-slate-400">{item.label}</div>
          <div className="mt-2 text-xl font-semibold text-slate-50">{item.value}</div>
          {item.hint ? <div className="mt-1 text-[11px] text-slate-400">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  )
}

export function PageSection({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
      {description ? (
        <div className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          {description}
        </div>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}
