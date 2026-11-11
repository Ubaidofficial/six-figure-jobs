// "Added in the last 24 hours": a slow strip of companies that got new $100k+ roles on the site today, each with how many.
// Plain server markup and CSS motion (no JavaScript): the list is rendered twice, side by side, and the pair slides
// left by half its width, so it loops without a seam. The second copy is `inert` (out of the tab order and from screen
// readers). It pauses on hover and focus; under prefers-reduced-motion it stops and the strip scrolls sideways by hand.
import Link from 'next/link'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { buildLogoUrl } from '@/lib/companies/logo'
import type { NewRolesCompany } from '@/lib/jobs/newRolesByCompany'

import styles from './NewRolesStrip.module.css'
import { SectionHeading } from '@/components/ui/SectionHeading'

/** Fewer companies than this and a moving strip looks empty; the section is left out. */
export const MIN_STRIP_COMPANIES = 4
const SECONDS_PER_CHIP = 3.5

function Chips({ companies, clone = false }: { companies: NewRolesCompany[]; clone?: boolean }) {
  return (
    <ul className={clone ? `${styles.list} ${styles.clone}` : styles.list} aria-hidden={clone || undefined} inert={clone || undefined}>
      {companies.map((company) => (
        <li key={company.id}>
          <Link
            href={`/company/${company.slug}`}
            prefetch={false}
            className={styles.chip}
            tabIndex={clone ? -1 : undefined}
            title={`${company.name}: ${company.newJobs} new ${company.newJobs === 1 ? 'role' : 'roles'} in the last 24 hours`}
          >
            <span className={styles.logo}>
              <CompanyLogo name={company.name} src={buildLogoUrl(company.logoUrl, company.website, company.name)} size="fill" />
            </span>
            <span className={styles.name}>{company.name}</span>
            <span className={styles.badge}>+{company.newJobs}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function NewRolesStrip({ companies }: { companies: NewRolesCompany[] }) {
  if (companies.length < MIN_STRIP_COMPANIES) return null

  return (
    <section className={styles.section} aria-labelledby="new-roles-heading">
      <header className={styles.header}>
        <SectionHeading id="new-roles-heading" light="Added in the" strong="last 24 hours" />
        <p className={styles.sub}>Companies with new roles on the site today. Tap a name to see their jobs.</p>
      </header>
      <div className={styles.viewport}>
        <div className={styles.rail} style={{ '--marquee-duration': `${Math.round(companies.length * SECONDS_PER_CHIP)}s` } as React.CSSProperties}>
          <Chips companies={companies} />
          <Chips companies={companies} clone />
        </div>
      </div>
    </section>
  )
}
