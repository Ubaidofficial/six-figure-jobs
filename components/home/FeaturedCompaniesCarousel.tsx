import Image from 'next/image'
import Link from 'next/link'

import styles from './FeaturedCompaniesCarousel.module.css'

export type FeaturedCompany = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  activeHighPayingJobs: number
}

function CompanyLogo({ company }: { company: FeaturedCompany }) {
  if (!company.logoUrl) {
    return (
      <div className={styles.fallback} aria-hidden="true">
        {(company.name?.[0] || 'C').toUpperCase()}
      </div>
    )
  }

  return (
    <Image
      src={company.logoUrl}
      alt={`${company.name} logo`}
      width={64}
      height={64}
      loading="lazy"
      unoptimized
      className={styles.logoImg}
    />
  )
}

function LogoItem({ company }: { company: FeaturedCompany }) {
  const href = `/company/${company.slug}`
  const tooltip = `${company.name} • ${company.activeHighPayingJobs.toLocaleString()} active $100k+ jobs`

  return (
    <li className={styles.item}>
      <Link href={href} className={styles.logoLink} aria-label={tooltip} title={tooltip}>
        <div className={styles.logoBox}>
          <CompanyLogo company={company} />
        </div>
        <span className={styles.tooltip} role="tooltip">
          {company.name}
        </span>
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
  const repeated = [...companies, ...companies]

  return (
    <div className={styles.marquee} data-reverse={reverse ? 'true' : 'false'}>
      <ul className={styles.track} aria-label="Featured companies">
        {repeated.map((company, idx) => (
          <LogoItem key={`${company.id}-${idx}`} company={company} />
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
        <h2 className={styles.title}>Trusted by Premium Companies</h2>
        <p className={styles.subtitle}>Join professionals at leading tech companies</p>
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

