import styles from './JobsLoading.module.css'

export default function Loading() {
  return (
    <main className={styles.page} aria-busy="true" aria-live="polite">
      <div className={styles.top}>
        <div className={`${styles.skeleton} ${styles.lineLg}`} />
        <div className={`${styles.skeleton} ${styles.lineSm}`} />
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-hidden="true">
          <div className={`${styles.skeleton} ${styles.panel}`} />
        </aside>

        <section className={styles.grid} aria-hidden="true">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className={`${styles.skeleton} ${styles.card}`} />
          ))}
        </section>
      </div>
    </main>
  )
}

