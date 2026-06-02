import Link from 'next/link'
import { Linkedin, MessageCircle, Twitter } from 'lucide-react'

import { FooterNewsletter } from './FooterNewsletter'
import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <section className={styles.newsletter} aria-label="Newsletter signup">
          <div>
            <div className={styles.newsletterTitle}>Get weekly six-figure jobs in your inbox</div>
            <div className={styles.newsletterSub}>Premium roles, verified salaries, no noise.</div>
          </div>
          <FooterNewsletter />
        </section>

        <div className={styles.columnsDesktop} aria-label="Footer links">
          <div className={styles.brand}>
            <Link href="/" className={styles.logo}>
              Six <span className={styles.logoAccent}>Figure</span> Jobs
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

          <div>
            <div className={styles.colTitle}>Explore</div>
            <div className={styles.list}>
              <Link className={styles.link} href="/jobs">All Jobs</Link>
              <Link className={styles.link} href="/remote">Remote Jobs</Link>
              <Link className={styles.link} href="/jobs/100k-plus">By Salary ($100k+)</Link>
              <Link className={styles.link} href="/jobs/200k-plus">By Salary ($200k+)</Link>
              <Link className={styles.link} href="/jobs/300k-plus">By Salary ($300k+)</Link>
              <Link className={styles.link} href="/jobs/400k-plus">By Salary ($400k+)</Link>
              <Link className={styles.link} href="/jobs/location/united-states">United States</Link>
              <Link className={styles.link} href="/jobs/location/united-kingdom">United Kingdom</Link>
              <Link className={styles.link} href="/jobs/location/canada">Canada</Link>
              <Link className={styles.link} href="/jobs/location/germany">Germany</Link>
              <Link className={styles.link} href="/jobs/location/australia">Australia</Link>
            </div>
          </div>

          <div>
            <div className={styles.colTitle}>Popular Roles</div>
            <div className={styles.list}>
              <Link className={styles.link} href="/jobs/software-engineer">Software Engineer</Link>
              <Link className={styles.link} href="/jobs/senior-software-engineer">Senior Software Engineer</Link>
              <Link className={styles.link} href="/jobs/full-stack-engineer">Full-Stack Engineer</Link>
              <Link className={styles.link} href="/jobs/data-scientist">Data Scientist</Link>
              <Link className={styles.link} href="/jobs/machine-learning-engineer">Machine Learning Engineer</Link>
              <Link className={styles.link} href="/jobs/product-manager">Product Manager</Link>
              <Link className={styles.link} href="/jobs/account-executive">Account Executive</Link>
              <Link className={styles.link} href="/jobs/engineering-manager">Engineering Manager</Link>
              <Link className={styles.link} href="/jobs/product-designer">Product Designer</Link>
            </div>
          </div>

          <div>
            <div className={styles.colTitle}>Salary Guides</div>
            <div className={styles.list}>
              <Link className={styles.link} href="/salary">All Salary Guides</Link>
              <Link className={styles.link} href="/salary/software-engineer">Software Engineer Salary</Link>
              <Link className={styles.link} href="/salary/data-scientist">Data Scientist Salary</Link>
              <Link className={styles.link} href="/salary/product-manager">Product Manager Salary</Link>
              <Link className={styles.link} href="/salary/account-executive">Account Executive Salary</Link>
              <Link className={styles.link} href="/salary/engineering-manager">Engineering Manager Salary</Link>
            </div>
          </div>

          <div>
            <div className={styles.colTitle}>Resources</div>
            <div className={styles.list}>
              <Link className={styles.link} href="/jobs">For Job Seekers</Link>
              <Link className={styles.link} href="/salary">Salary Guide</Link>
              <Link className={styles.link} href="/blog">Career Blog</Link>
              <Link className={styles.link} href="/jobs/visa-sponsorship">Visa Sponsorship Jobs</Link>
              <Link className={styles.link} href="/jobs/no-degree">No-Degree Tech Jobs</Link>
              <Link className={styles.link} href="/companies">Top Companies</Link>
            </div>
          </div>

          <div>
            <div className={styles.colTitle}>Company</div>
            <div className={styles.list}>
              <Link className={styles.link} href="/about">About Us</Link>
              <Link className={styles.link} href="/about#contact">Contact</Link>
              <Link className={styles.link} href="/privacy">Privacy Policy</Link>
              <Link className={styles.link} href="/terms">Terms of Service</Link>
            </div>
          </div>
        </div>

        <div className={styles.columnsMobile} aria-label="Footer links (mobile)">
          <div className={styles.brand}>
            <Link href="/" className={styles.logo}>
              Six <span className={styles.logoAccent}>Figure</span> Jobs
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

          <details className={styles.accordion}>
            <summary className={styles.summary}>
              Explore <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.accordionBody}>
              <div className={styles.list}>
                <Link className={styles.link} href="/jobs">All Jobs</Link>
                <Link className={styles.link} href="/remote">Remote Jobs</Link>
                <Link className={styles.link} href="/jobs/100k-plus">$100k+</Link>
                <Link className={styles.link} href="/jobs/200k-plus">$200k+</Link>
                <Link className={styles.link} href="/jobs/300k-plus">$300k+</Link>
                <Link className={styles.link} href="/jobs/400k-plus">$400k+</Link>
                <Link className={styles.link} href="/jobs/location/united-states">United States</Link>
                <Link className={styles.link} href="/jobs/location/united-kingdom">United Kingdom</Link>
                <Link className={styles.link} href="/jobs/location/canada">Canada</Link>
                <Link className={styles.link} href="/jobs/location/germany">Germany</Link>
                <Link className={styles.link} href="/jobs/location/australia">Australia</Link>
              </div>
            </div>
          </details>

          <details className={styles.accordion}>
            <summary className={styles.summary}>
              Popular Roles <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.accordionBody}>
              <div className={styles.list}>
                <Link className={styles.link} href="/jobs/software-engineer">Software Engineer</Link>
                <Link className={styles.link} href="/jobs/senior-software-engineer">Senior Software Engineer</Link>
                <Link className={styles.link} href="/jobs/full-stack-engineer">Full-Stack Engineer</Link>
                <Link className={styles.link} href="/jobs/data-scientist">Data Scientist</Link>
                <Link className={styles.link} href="/jobs/machine-learning-engineer">Machine Learning Engineer</Link>
                <Link className={styles.link} href="/jobs/product-manager">Product Manager</Link>
                <Link className={styles.link} href="/jobs/account-executive">Account Executive</Link>
                <Link className={styles.link} href="/jobs/engineering-manager">Engineering Manager</Link>
                <Link className={styles.link} href="/jobs/product-designer">Product Designer</Link>
              </div>
            </div>
          </details>

          <details className={styles.accordion}>
            <summary className={styles.summary}>
              Salary Guides <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.accordionBody}>
              <div className={styles.list}>
                <Link className={styles.link} href="/salary">All Salary Guides</Link>
                <Link className={styles.link} href="/salary/software-engineer">Software Engineer Salary</Link>
                <Link className={styles.link} href="/salary/data-scientist">Data Scientist Salary</Link>
                <Link className={styles.link} href="/salary/product-manager">Product Manager Salary</Link>
                <Link className={styles.link} href="/salary/account-executive">Account Executive Salary</Link>
                <Link className={styles.link} href="/salary/engineering-manager">Engineering Manager Salary</Link>
              </div>
            </div>
          </details>

          <details className={styles.accordion}>
            <summary className={styles.summary}>
              Resources <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.accordionBody}>
              <div className={styles.list}>
                <Link className={styles.link} href="/jobs">For Job Seekers</Link>
                <Link className={styles.link} href="/salary">Salary Guide</Link>
                <Link className={styles.link} href="/blog">Career Blog</Link>
                <Link className={styles.link} href="/jobs/visa-sponsorship">Visa Sponsorship Jobs</Link>
                <Link className={styles.link} href="/jobs/no-degree">No-Degree Tech Jobs</Link>
                <Link className={styles.link} href="/companies">Top Companies</Link>
              </div>
            </div>
          </details>

          <details className={styles.accordion}>
            <summary className={styles.summary}>
              Company <span className={styles.chev}>⌄</span>
            </summary>
            <div className={styles.accordionBody}>
              <div className={styles.list}>
                <Link className={styles.link} href="/about">About Us</Link>
                <Link className={styles.link} href="/about#contact">Contact</Link>
                <Link className={styles.link} href="/privacy">Privacy Policy</Link>
                <Link className={styles.link} href="/terms">Terms of Service</Link>
              </div>
            </div>
          </details>
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
          </div>
          <div className={styles.made}>Made with 💚 for high earners</div>
        </div>
      </div>
    </footer>
  )
}
