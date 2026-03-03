import { Building2, Check, Globe, Target } from 'lucide-react'

import styles from './WhySixFigureJobs.module.css'

const FEATURES = [
  {
    title: '100% Verified Salaries',
    description:
      'Every salary verified from ATS systems. No guesswork, no ranges that start at $50k.',
    Icon: Check,
    visual: (
      <div className={styles.visualRow} aria-hidden="true">
        <span className={styles.pillStrong}>ATS Verified</span>
        <span className={styles.pill}>Salary Confidence</span>
      </div>
    ),
  },
  {
    title: 'No Entry-Level Noise',
    description:
      "Exclusively $100k+ positions. We filter out junior roles so you don't have to.",
    Icon: Target,
    visual: (
      <div className={styles.visualRow} aria-hidden="true">
        <span className={styles.pillStrong}>$100k+ Only</span>
        <span className={styles.pill}>No Internships</span>
      </div>
    ),
  },
  {
    title: 'PPP-Adjusted Worldwide',
    description:
      'Fair thresholds for every country. £80k in UK, €90k in Germany, $150k in Australia.',
    Icon: Globe,
    visual: (
      <div className={styles.currency} aria-hidden="true">
        <span className={styles.currencyChip}>£</span>
        <span className={styles.currencyChip}>€</span>
        <span className={styles.currencyChip}>$</span>
        <span className={styles.currencyChip}>A$</span>
      </div>
    ),
  },
  {
    title: 'Premium Companies Only',
    description:
      'Vetted companies from startups to enterprises. Direct links to application pages.',
    Icon: Building2,
    visual: (
      <div className={styles.logoStack} aria-hidden="true">
        <span className={styles.logoDot} />
        <span className={styles.logoDot} />
        <span className={styles.logoDot} />
        <span className={styles.logoDot} />
      </div>
    ),
  },
] as const

export function WhySixFigureJobs() {
  return (
    <section className={styles.section} aria-label="Why Six Figure Jobs">
      <header className={styles.header}>
        <h2 className={styles.title}>Why Six Figure Jobs?</h2>
        <p className={styles.subtitle}>
          The premium job board for high-earning professionals
        </p>
      </header>

      <div className={styles.grid}>
        {FEATURES.map(({ title, description, Icon, visual }) => (
          <article key={title} className={styles.card}>
            <div className={styles.iconWrap} aria-hidden="true">
              <Icon className={styles.icon} />
            </div>

            <h3 className={styles.cardTitle}>{title}</h3>
            <p className={styles.cardDesc}>{description}</p>

            <div className={styles.visual}>{visual}</div>
          </article>
        ))}
      </div>
    </section>
  )
}

