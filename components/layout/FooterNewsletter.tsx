import styles from './FooterNewsletter.module.css'

// The footer used to show an email form that only saved the address in the visitor's own browser and then said
// "Subscribed" — nothing was stored or ever sent (found 2026-11-08). Until real email alerts exist, offer what does
// work: the public RSS feeds, which any feed reader, Slack or email-digest service can follow.
export function FooterNewsletter() {
  return (
    <div className={styles.form}>
      <a className={styles.button} href="/feeds/jobs.rss">
        All jobs feed
      </a>
      <a className={styles.button} href="/feeds/remote-jobs.rss">
        Remote jobs feed
      </a>
    </div>
  )
}
