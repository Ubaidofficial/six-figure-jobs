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

function MarqueeRow({
  companies,
  reverse = false,
}: {
  companies: FeaturedCompany[]
  reverse?: boolean
}) {
  return (
    <div className={styles.marquee} data-reverse={reverse ? 'true' : 'false'}>
      <ul className={styles.track} aria-label="Featured companies">
        {companies.map((company, idx) => (
          <LogoItem key={company.id} company={company} index={idx} />
        ))}
      </ul>
    </div>
  )
}

export function FeaturedCompaniesCarousel({ companies }: { companies: FeaturedCompany[] }) {
  if (!companies || companies.length === 0) return null

  const firstRow = companies.slice(0, 10)
  const secondRow = companies.slice(10, 20)

  return (
    <section className={styles.section} aria-label="Featured companies">
      <div className={styles.header}>
        <h2 className={styles.title}>Top Companies Hiring Now</h2>
        <p className={styles.subtitle}>$100k+ roles at the companies hiring most</p>
      </div>

      <div className={styles.card}>
        <div className={styles.rows}>
          <div className={styles.desktopRow}>
            <MarqueeRow companies={companies} />
          </div>

          <div className={styles.mobileRows}>
            <MarqueeRow companies={firstRow.length ? firstRow : companies} />
            <MarqueeRow companies={secondRow.length ? secondRow : companies} reverse />
          </div>
        </div>
      </div>
    </section>
  )
}
