// Building blocks for the job detail page. Server components on shadcn's Card/Badge/Separator, styled with
// the site's theme tokens. The page keeps rendering on the server; only the logo and save/share buttons hydrate.
import type { ReactNode } from 'react'
import NextLink from 'next/link'
import { BadgeCheck, ExternalLink, Globe } from 'lucide-react'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import { JobActions } from './JobActions'

type Fact = { label: string; value: string }

const applyButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function ApplyButton({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className={cn(applyButtonClass, className)}
    >
      {label} <ExternalLink className="size-4" aria-hidden="true" />
    </a>
  )
}

/** Section of the article: a real heading, then content. No card chrome, so the page reads top to bottom. */
export function JobSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground/90 marker:text-primary">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** Right-rail card: the numbers that decide whether to apply, and the one button to do it. */
export function ApplyCard({
  salaryText,
  salaryIsFromEmployer,
  applyHref,
  companyName,
  facts,
  jobId,
  shareUrl,
}: {
  salaryText: string | null
  salaryIsFromEmployer: boolean
  applyHref: string | null
  companyName: string
  facts: Fact[]
  jobId: string
  shareUrl: string
}) {
  return (
    <Card className="p-5">
      <h2 className="sr-only">Compensation and how to apply</h2>

      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Salary</p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
        {salaryText || 'Not disclosed'}
      </p>
      {salaryText ? (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
          {salaryIsFromEmployer ? 'From the employer’s posting' : 'Listed in the posting'}
        </p>
      ) : null}

      {applyHref ? (
        <>
          <ApplyButton href={applyHref} label="Apply on company site" className="mt-5 w-full" />
          <p className="mt-2 text-xs text-muted-foreground">
            Opens {companyName}&rsquo;s own application page in a new tab. Six Figure Jobs doesn&rsquo;t track it.
          </p>
        </>
      ) : null}

      {facts.length > 0 ? (
        <>
          <Separator className="my-5" />
          <dl className="space-y-3 text-sm">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="text-right font-medium text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}

      <Separator className="my-5" />
      <div className="flex items-center gap-2">
        <JobActions jobId={jobId} shareUrl={shareUrl} />
      </div>
    </Card>
  )
}

export function CompanyCard({
  name,
  slug,
  logoSrc,
  description,
  facts,
  websiteHref,
}: {
  name: string
  slug: string | null
  logoSrc: string | null
  description: string | null
  facts: Fact[]
  websiteHref: string | null
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <CompanyLogo name={name} src={logoSrc} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground">{name}</h2>
          {slug ? (
            <NextLink href={`/company/${slug}`} className="text-sm text-primary hover:underline underline-offset-4">
              All jobs at {name}
            </NextLink>
          ) : null}
        </div>
      </div>

      {description ? (
        <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}

      {facts.length > 0 ? (
        <dl className="mt-4 space-y-2 text-sm">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="text-right font-medium text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {websiteHref ? (
        <a
          href={websiteHref}
          target="_blank"
          rel="nofollow noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Globe className="size-4" aria-hidden="true" /> Company website
        </a>
      ) : null}
    </Card>
  )
}

/** Sticky bar for phones: salary plus the Apply button, always reachable while reading. */
export function MobileApplyBar({ salaryText, applyHref }: { salaryText: string | null; applyHref: string | null }) {
  if (!applyHref) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Salary</p>
          <p className="truncate font-mono text-base font-semibold text-foreground">{salaryText || 'Not disclosed'}</p>
        </div>
        <ApplyButton href={applyHref} label="Apply" className="shrink-0 px-6" />
      </div>
    </div>
  )
}

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-nowrap items-center text-sm text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={item.label} className={cn('flex items-center', last ? 'min-w-0 flex-1' : 'shrink-0')}>
              {i > 0 ? (
                <span aria-hidden="true" className="mx-2 text-muted-foreground/60">
                  ›
                </span>
              ) : null}
              {item.href && !last ? (
                <NextLink href={item.href} className="hover:text-foreground hover:underline underline-offset-4">
                  {item.label}
                </NextLink>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn(last && 'truncate text-foreground')}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

