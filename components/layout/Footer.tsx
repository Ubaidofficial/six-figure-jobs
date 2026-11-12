import Link from '@/components/ui/Link'
import { Linkedin, MessageCircle, Twitter } from 'lucide-react'

import { RegionMark } from '@/components/ui/RegionMark'

import { JobAlertBox } from '@/components/alerts/JobAlertBox'
import { alertsEnabled } from '@/lib/alerts/config'

import { FooterNewsletter } from './FooterNewsletter'
import { FOOTER_COLUMNS } from './footerLinks'
import styles from './Footer.module.css'
import { Wordmark } from './Wordmark'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {alertsEnabled() ? (
          <section className={styles.newsletter} aria-label="Follow new jobs">
            <JobAlertBox query={{}} variant="footer" />
          </section>
        ) : (
          <section className={styles.newsletter} aria-label="Follow new jobs">
            <div>
              <div className={styles.newsletterTitle}>Follow new six-figure jobs</div>
              <div className={styles.newsletterSub}>
                Email alerts are coming. Until then, add a feed to any RSS reader, Slack or Feedly: new jobs with pay ranges.
              </div>
            </div>
            <FooterNewsletter />
          </section>
        )}

        <div className={styles.columnsDesktop} aria-label="Footer links">
          <div className={styles.brand}>
            <Link href="/" className={styles.logo}>
              <Wordmark />
            </Link>
            <div className={styles.tagline}>Premium jobs for high earners.</div>
            <div className={styles.socialRow} aria-label="Social links">
              <a
                className={styles.social}
                href="https://linkedin.com/company/sixfigjobs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Six Figure Jobs on LinkedIn"
              >
                <Linkedin className={styles.socialIcon} aria-hidden="true" />
              </a>
              <a
                className={styles.social}
                href="https://twitter.com/6figjobs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Six Figure Jobs on Twitter"
              >
                <Twitter className={styles.socialIcon} aria-hidden="true" />
              </a>
              <a
                className={styles.social}
                href="https://discord.gg/6figjobs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Six Figure Jobs on Discord"
              >
                <MessageCircle className={styles.socialIcon} aria-hidden="true" />
              </a>
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <div className={styles.colTitle}>{col.title}</div>
              <div className={styles.list}>
                {col.links.map(([label, href, mark]) => (
                  <Link key={href} className={styles.link} href={href}>
                    <RegionMark mark={mark} className="mr-2" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.columnsMobile} aria-label="Footer links (mobile)">
          <div className={styles.brand}>
            <Link href="/" className={styles.logo}>
              <Wordmark />
            </Link>
            <div className={styles.tagline}>Premium jobs for high earners.</div>
            <div className={styles.socialRow} aria-label="Social links">
              <a
                className={styles.social}
                href="https://linkedin.com/company/sixfigjobs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Six Figure Jobs on LinkedIn"
              >
                <Linkedin className={styles.socialIcon} aria-hidden="true" />
              </a>
              <a
                className={styles.social}
                href="https://twitter.com/6figjobs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Six Figure Jobs on Twitter"
              >
                <Twitter className={styles.socialIcon} aria-hidden="true" />
              </a>
              <a
                className={styles.social}
                href="https://discord.gg/6figjobs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Six Figure Jobs on Discord"
              >
                <MessageCircle className={styles.socialIcon} aria-hidden="true" />
              </a>
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <details key={col.title} className={styles.accordion}>
              <summary className={styles.summary}>
                {col.title} <span className={styles.chev}>⌄</span>
              </summary>
              <div className={styles.accordionBody}>
                <div className={styles.list}>
                  {col.links.map(([label, href, mark]) => (
                    <Link key={href} className={styles.link} href={href}>
                      <RegionMark mark={mark} className="mr-2" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.bottomInner}>
          <div>© {new Date().getFullYear()} Six Figure Jobs</div>
          <div className={styles.bottomLinks}>
            <Link className={styles.link} href="/privacy">Privacy</Link>
            <span className={styles.dot} aria-hidden="true">•</span>
            <Link className={styles.link} href="/terms">Terms</Link>
            <span className={styles.dot} aria-hidden="true">•</span>
            <Link className={styles.link} href="/sitemap.xml">Sitemap</Link>
            <span className={styles.dot} aria-hidden="true">•</span>
            <a className={styles.link} href="https://logo.dev" target="_blank" rel="noopener">Logos provided by Logo.dev</a>
          </div>
          <div className={styles.made}>Made with 💚 for high earners</div>
        </div>
      </div>
    </footer>
  )
}
