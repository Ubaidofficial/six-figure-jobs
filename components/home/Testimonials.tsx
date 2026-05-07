import styles from './Testimonials.module.css'

const TESTIMONIALS = [
  {
    quote:
      "Found a $180k remote role in 4 days. Every listing showed a real salary — no 'competitive compensation' nonsense.",
    name: 'Marcus T.',
    role: 'Staff Software Engineer',
    initials: 'MT',
  },
  {
    quote:
      "The salary verification is the killer feature. I stopped wasting time on listings that turn out to be $70k roles in disguise.",
    name: 'Priya S.',
    role: 'Senior Data Scientist',
    initials: 'PS',
  },
  {
    quote:
      "Landed a $240k engineering manager role through here. Bookmarked it permanently. No other board filters this well.",
    name: 'Jordan K.',
    role: 'Engineering Manager',
    initials: 'JK',
  },
] as const

function Stars() {
  return (
    <div className={styles.stars} aria-label="5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={styles.star} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1l1.9 3.9L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.1-.7z" />
        </svg>
      ))}
    </div>
  )
}

export function Testimonials() {
  return (
    <section className={styles.section} aria-label="User testimonials">
      <header className={styles.header}>
        <h2 className={styles.title}>Trusted by high earners</h2>
        <p className={styles.subtitle}>
          Real results from professionals who found six-figure roles
        </p>
      </header>

      <div className={styles.grid}>
        {TESTIMONIALS.map(({ quote, name, role, initials }) => (
          <article key={name} className={styles.card}>
            <Stars />
            <blockquote className={styles.quote}>"{quote}"</blockquote>
            <footer className={styles.author}>
              <div className={styles.avatar} aria-hidden="true">
                {initials}
              </div>
              <div>
                <div className={styles.authorName}>{name}</div>
                <div className={styles.authorRole}>{role}</div>
              </div>
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}
