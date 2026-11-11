import type { ReactNode } from 'react'

// Flat page chrome for guide-style pages (salary guides etc.): heading, a ruled stat strip, plain sections.
// Theme tokens only (no hard-coded colours) so light and dark both work.

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
    <header className="border-b border-border pb-8">
      {eyebrow ? (
        <p className="eyebrow-pill">{eyebrow}</p>
      ) : null}
      <h1 className="mt-4 text-4xl font-normal leading-[1.05] tracking-[-0.035em] text-foreground sm:text-5xl">{title}</h1>
      <div className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">{description}</div>
      {helper ? <div className="mt-3 text-sm text-muted-foreground">{helper}</div> : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
      {children ? <div className="mt-6">{children}</div> : null}
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
    <dl className="panel-hairline grid grid-cols-2 gap-x-6 gap-y-5 px-6 py-5 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold text-foreground">{item.value}</dd>
          {item.hint ? <dd className="mt-1 text-xs text-muted-foreground">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
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
    <section className="mt-12" data-reveal="">
      <h2 className="text-2xl font-medium tracking-[-0.025em] text-foreground">{title}</h2>
      {description ? (
        <div className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{description}</div>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}
