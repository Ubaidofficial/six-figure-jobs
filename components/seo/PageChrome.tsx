import type { CSSProperties, ReactNode } from 'react'

// Soft emerald aura that echoes the homepage Hero's radial gradient, scaled
// down for the compact secondary-page header. Visible enough to read as
// "same brand", subtle enough not to compete with content.
const HERO_BACKDROP: CSSProperties = {
  background:
    'radial-gradient(110% 80% at 12% 0%, rgba(16, 185, 129, 0.14), transparent 65%), radial-gradient(80% 60% at 90% 100%, rgba(16, 185, 129, 0.08), transparent 70%), rgba(16, 16, 16, 0.85)',
}

const STAT_CARD_BACKDROP: CSSProperties = {
  background:
    'linear-gradient(160deg, rgba(28, 28, 28, 0.9) 0%, rgba(18, 18, 18, 0.85) 100%)',
}

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
    <header
      className="relative overflow-hidden rounded-2xl border border-white/10 p-6 shadow-[0_18px_60px_-30px_rgba(16,185,129,0.25)] transition-shadow duration-300 hover:shadow-[0_18px_60px_-20px_rgba(16,185,129,0.32)]"
      style={HERO_BACKDROP}
    >
      {/* Decorative top edge highlight — barely visible, just adds depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
      />
      <div className="relative">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
        <div className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-300">
          {description}
        </div>
        {helper ? <div className="mt-3 text-xs text-neutral-400">{helper}</div> : null}
        {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="group rounded-xl border border-white/10 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-700/40 hover:shadow-[0_12px_30px_-10px_rgba(16,185,129,0.20)]"
          style={STAT_CARD_BACKDROP}
        >
          <div className="text-xs uppercase tracking-wide text-neutral-400">{item.label}</div>
          <div className="mt-2 text-lg sm:text-xl font-semibold text-white transition-colors group-hover:text-emerald-200">
            {item.value}
          </div>
          {item.hint ? <div className="mt-1 text-[11px] text-neutral-400">{item.hint}</div> : null}
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
    <section
      className="rounded-2xl border border-white/10 p-5 shadow-sm transition-shadow duration-300 hover:shadow-[0_12px_40px_-20px_rgba(16,185,129,0.15)]"
      style={STAT_CARD_BACKDROP}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
        {title}
      </h2>
      {description ? (
        <div className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300">
          {description}
        </div>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}
