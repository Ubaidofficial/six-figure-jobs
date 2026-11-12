import Link from '@/components/ui/Link'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { buildLogoUrl } from '@/lib/companies/logo'
import styles from './FeaturedCompaniesCarousel.module.css'
import { SectionHeading } from '@/components/ui/SectionHeading'

export type FeaturedCompany = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  website: string | null
  activeHighPayingJobs: number
}

const SECONDS_PER_LOGO = 3

function LogoItem({ company, index, clone }: { company: FeaturedCompany; index: number; clone: boolean }) {
  const href = `/company/${company.slug}`
  const tooltip = `${company.name} • ${company.activeHighPayingJobs.toLocaleString()} active $100k+ jobs`

  return (
    <li className={styles.item}>
      <Link href={href} className={styles.logoLink} aria-label={tooltip} title={tooltip} tabIndex={clone ? -1 : undefined}>
        <div className={styles.logoBox}>
          <CompanyLogo
            name={company.name}
            src={buildLogoUrl(company.logoUrl, company.website, company.name)}
            size="fill"
            priority={!clone && index < 4}
          />
        </div>
        <span className="sr-only">{company.name}</span>
      </Link>
    </li>
  )
}

// Each half of a rail holds at least this many logos, so it is wider than the widest screens and the loop never shows
// a gap; a short row is repeated to reach it.
const MIN_LOGOS_PER_HALF = 24

/** One sliding row: two equal halves side by side; moving by half the rail is one half, so the loop has no seam. Only
 *  the first list is real; the repeats are `inert` (out of the tab order and hidden from screen readers), so each
 *  company is listed once. */
function LogoRow({ companies, offset, reverse }: { companies: FeaturedCompany[]; offset: number; reverse?: boolean }) {
  const repeats = Math.max(1, Math.ceil(MIN_LOGOS_PER_HALF / companies.length))
  const duration = `${Math.max(20, companies.length * repeats * SECONDS_PER_LOGO)}s`
  return (
    <div className={styles.viewport}>
      <div
        className={reverse ? `${styles.rail} ${styles.railReverse}` : styles.rail}
        style={{ '--marquee-duration': duration } as React.CSSProperties}
      >
        {Array.from({ length: repeats * 2 }, (_, copy) => {
          const clone = copy > 0
          return (
            <ul
              key={copy}
              className={clone ? `${styles.track} ${styles.clone}` : styles.track}
              aria-label={clone ? undefined : 'Featured companies'}
              aria-hidden={clone || undefined}
              inert={clone || undefined}
            >
              {companies.map((company, i) => (
                <LogoItem key={company.id} company={company} index={offset + i} clone={clone} />
              ))}
            </ul>
          )
        })}
      </div>
    </div>
  )
}

export function FeaturedCompaniesCarousel({ companies }: { companies: FeaturedCompany[] }) {
  if (!companies || companies.length === 0) return null

  // Two rows sliding in opposite directions (2026-11-12, owner's request), each company in one row only. Pauses on
  // hover or keyboard focus; under reduced motion the rows stand still and scroll sideways by hand.
  const half = Math.ceil(companies.length / 2)
  const rows = companies.length > 8 ? [companies.slice(0, half), companies.slice(half)] : [companies]

  return (
    <section className={styles.section} aria-labelledby="featured-companies-title">
      <div className={styles.header}>
        <div>
          <SectionHeading id="featured-companies-title" eyebrow="Companies" light="Top Companies" strong="Hiring Now" />
          <p className={styles.subtitle}>$100k+ roles at the companies hiring most</p>
        </div>
        <Link href="/companies" className={`arrow-link ${styles.allLink}`}>
          <span className="arrow-link-label">See all companies</span>
          <span className="arrow-chip" aria-hidden="true">&#8599;</span>
        </Link>
      </div>

      <div className={styles.card}>
        {rows.map((row, i) => (
          <LogoRow key={i} companies={row} offset={i === 0 ? 0 : half} reverse={i === 1} />
        ))}
      </div>
    </section>
  )
}
