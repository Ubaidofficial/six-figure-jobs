import Link from 'next/link'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { buildLogoUrl } from '@/lib/companies/logo'
import styles from './FeaturedCompaniesCarousel.module.css'

export type FeaturedCompany = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  website: string | null
  activeHighPayingJobs: number
}

function LogoItem({ company, index }: { company: FeaturedCompany; index: number }) {
  const href = `/company/${company.slug}`
  const tooltip = `${company.name} • ${company.activeHighPayingJobs.toLocaleString()} active $100k+ jobs`

  return (
    <li className={styles.item}>
      <Link href={href} className={styles.logoLink} aria-label={tooltip} title={tooltip}>
        <div className={styles.logoBox}>
          <CompanyLogo
            name={company.name}
            src={buildLogoUrl(company.logoUrl, company.website, company.name)}
            size="fill"
            priority={index < 4}
          />
        </div>
        <span className="sr-only">{company.name}</span>
      </Link>
    </li>
  )
}

export function FeaturedCompaniesCarousel({ companies }: { companies: FeaturedCompany[] }) {
  if (!companies || companies.length === 0) return null

  // One list, each company once: two rows that wrap on wide screens, one row to swipe on phones (2026-11-09; the phone
  // layout used to repeat every logo in a second copy of the list and grew to seven rows under the hero).
  return (
    <section className={styles.section} aria-labelledby="featured-companies-title">
      <div className={styles.header}>
        <div>
          <h2 id="featured-companies-title" className={styles.title}>
            Top Companies Hiring Now
          </h2>
          <p className={styles.subtitle}>$100k+ roles at the companies hiring most</p>
        </div>
        <Link href="/companies" className={styles.allLink}>
          See all companies <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className={styles.card}>
        <ul className={styles.track} aria-label="Featured companies">
          {companies.map((company, idx) => (
            <LogoItem key={company.id} company={company} index={idx} />
          ))}
        </ul>
      </div>
    </section>
  )
}
