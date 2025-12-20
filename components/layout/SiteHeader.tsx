'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Menu, Search, X } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'

import styles from './SiteHeader.module.css'

type NavLink = { href: string; title: string; description?: string; onClick?: () => void }

const SALARY_LINKS: NavLink[] = [
  { href: '/jobs/100k-plus', title: '$100k+ jobs', description: 'Core six-figure roles' },
  { href: '/jobs/200k-plus', title: '$200k+ jobs', description: 'Senior + staff band' },
  { href: '/jobs/300k-plus', title: '$300k+ jobs', description: 'Principal + leadership band' },
  { href: '/jobs/400k-plus', title: '$400k+ jobs', description: 'Executive + elite band' },
  { href: '/salary', title: 'Salary guides', description: 'Role-based compensation insights' },
]

const LOCATION_LINKS: NavLink[] = [
  { href: '/jobs/location/united-states', title: 'United States', description: '$100k+ (USD)' },
  { href: '/jobs/location/united-kingdom', title: 'United Kingdom', description: '£70k+ (GBP)' },
  { href: '/jobs/location/canada', title: 'Canada', description: '$120k+ (CAD)' },
  { href: '/jobs/location/germany', title: 'Germany', description: '€80k+ (EUR)' },
  { href: '/jobs/location/australia', title: 'Australia', description: '$140k+ (AUD)' },
  { href: '/jobs/location/netherlands', title: 'Netherlands', description: '€80k+ (EUR)' },
]

function useScrolled(thresholdPx: number = 10): boolean {
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > thresholdPx)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [thresholdPx])

  return scrolled
}

function MenuItem({ href, title, description, onClick }: NavLink) {
  return (
    <DropdownMenuItem asChild className={styles.dropdownItem}>
      <Link href={href} onClick={onClick}>
        <div>
          <div className={styles.dropdownItemTitle}>{title}</div>
          {description ? <div className={styles.dropdownItemDesc}>{description}</div> : null}
        </div>
      </Link>
    </DropdownMenuItem>
  )
}

export function SiteHeader() {
  const scrolled = useScrolled(8)
  const router = useRouter()

  const [jobsOpen, setJobsOpen] = React.useState(false)
  const closeTimer = React.useRef<number | null>(null)

  const [searchOpen, setSearchOpen] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const scheduleClose = React.useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setJobsOpen(false), 200)
  }, [])

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }, [])

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    }
  }, [])

  React.useEffect(() => {
    if (!searchOpen) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [searchOpen])

  const submitSearch = React.useCallback(
    (value: string) => {
      const q = value.trim()
      if (!q) return
      setSearchOpen(false)
      setMobileOpen(false)
      router.push(`/search?q=${encodeURIComponent(q)}`)
    },
    [router]
  )

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>

      <div className={styles.inner}>
        <div className={styles.left}>
          <Link href="/" className={styles.logo} aria-label="Six Figure Jobs home">
            Six <span className={styles.logoAccent}>Figure</span> Jobs
          </Link>
          <span className={styles.kicker} aria-hidden="true">
            <span className={styles.kickerStrong}>$100k+</span> verified only
          </span>

          <nav className={styles.nav} aria-label="Primary">
            <DropdownMenu open={jobsOpen} onOpenChange={setJobsOpen}>
              <div
                className={styles.dropdownRegion}
                onMouseEnter={() => {
                  cancelClose()
                  setJobsOpen(true)
                }}
                onMouseLeave={scheduleClose}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={styles.navTrigger}
                    aria-haspopup="menu"
                    aria-expanded={jobsOpen}
                    onFocus={() => setJobsOpen(true)}
                  >
                    Jobs <ChevronDown className={styles.chev} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className={styles.dropdown}
                  sideOffset={10}
                  portalled={false}
                  onMouseLeave={scheduleClose}
                >
                  <DropdownMenuLabel className={styles.dropdownLabel}>Explore</DropdownMenuLabel>
                  <MenuItem
                    href="/jobs"
                    title="All jobs"
                    description="Explore every $100k+ listing"
                    onClick={() => setJobsOpen(false)}
                  />
                  <MenuItem
                    href="/remote"
                    title="Remote"
                    description="Work from anywhere roles"
                    onClick={() => setJobsOpen(false)}
                  />

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className={styles.dropdownLabel}>By Salary</DropdownMenuLabel>
                  {SALARY_LINKS.map((l) => (
                    <MenuItem key={l.href} {...l} onClick={() => setJobsOpen(false)} />
                  ))}

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className={styles.dropdownLabel}>By Location</DropdownMenuLabel>
                  {LOCATION_LINKS.map((l) => (
                    <MenuItem key={l.href} {...l} onClick={() => setJobsOpen(false)} />
                  ))}
                </DropdownMenuContent>
              </div>
            </DropdownMenu>

            <Link href="/companies" className={styles.navLink}>
              Companies
            </Link>

            <Link href="/post-a-job" className={styles.navLink}>
              For Employers
            </Link>
          </nav>
        </div>

        <div className={styles.right}>
          <button
            type="button"
            className={styles.searchBtn}
            aria-label="Find your next six-figure job"
            onClick={() => setSearchOpen(true)}
          >
            <Search className={styles.searchIcon} aria-hidden="true" />
          </button>

          <Link href="/post-a-job" className={styles.signIn}>
            Sign In
          </Link>

          <Link href="/post-a-job" className={styles.cta}>
            Post a Job
          </Link>

          <span className={styles.mobileOnly}>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button type="button" className={styles.hamburger} aria-label="Open menu">
                  <Menu className={styles.searchIcon} aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className={styles.mobileSheet} hideClose>
                <div className={styles.mobileHeader}>
                  <Link href="/" className={styles.logo} onClick={() => setMobileOpen(false)}>
                    Six <span className={styles.logoAccent}>Figure</span> Jobs
                  </Link>
                  <SheetClose asChild>
                    <button type="button" className={styles.mobileClose} aria-label="Close menu">
                      <X className={styles.mobileCloseIcon} aria-hidden="true" />
                    </button>
                  </SheetClose>
                </div>

                <div className={styles.mobileNav}>
                  <div className={styles.mobileSection}>
                    <div className={styles.mobileSectionTitle}>Jobs</div>
                    <Link className={styles.mobileItem} href="/jobs" onClick={() => setMobileOpen(false)}>
                      All jobs <span className={styles.mobileMeta}>/jobs</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/remote" onClick={() => setMobileOpen(false)}>
                      Remote <span className={styles.mobileMeta}>/remote</span>
                    </Link>
                  </div>

                  <div className={styles.mobileSection}>
                    <div className={styles.mobileSectionTitle}>By Salary</div>
                    {SALARY_LINKS.map((l) => (
                      <Link
                        key={l.href}
                        className={styles.mobileItem}
                        href={l.href}
                        onClick={() => setMobileOpen(false)}
                      >
                        {l.title} <span className={styles.mobileMeta}>{l.description ?? ''}</span>
                      </Link>
                    ))}
                  </div>

                  <div className={styles.mobileSection}>
                    <div className={styles.mobileSectionTitle}>By Location</div>
                    {LOCATION_LINKS.map((l) => (
                      <Link
                        key={l.href}
                        className={styles.mobileItem}
                        href={l.href}
                        onClick={() => setMobileOpen(false)}
                      >
                        {l.title} <span className={styles.mobileMeta}>{l.description ?? ''}</span>
                      </Link>
                    ))}
                  </div>

                  <div className={styles.mobileSection}>
                    <div className={styles.mobileSectionTitle}>More</div>
                    <Link className={styles.mobileItem} href="/companies" onClick={() => setMobileOpen(false)}>
                      Companies <span className={styles.mobileMeta}>/companies</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/post-a-job" onClick={() => setMobileOpen(false)}>
                      For Employers <span className={styles.mobileMeta}>/post-a-job</span>
                    </Link>
                    <button
                      type="button"
                      className={styles.mobileItem}
                      onClick={() => {
                        setMobileOpen(false)
                        setSearchOpen(true)
                      }}
                    >
                      Find jobs <span className={styles.mobileMeta}>/search</span>
                    </button>
                  </div>

                  <div className={styles.mobileActions}>
                    <Link href="/post-a-job" className={styles.mobileSignIn} onClick={() => setMobileOpen(false)}>
                      Sign In
                    </Link>
                    <Link href="/post-a-job" className={styles.mobileCta} onClick={() => setMobileOpen(false)}>
                      Post a Job
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </span>
        </div>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className={styles.searchDialog}>
          <DialogHeader>
            <DialogTitle className={styles.searchTitle}>Find your next six-figure job</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitSearch(query)
            }}
          >
            <div className={styles.searchRow}>
              <input
                ref={inputRef}
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find roles, companies, or skills…"
                aria-label="Find roles, companies, or skills"
              />
              <button type="submit" className={styles.searchGo}>
                Find
              </button>
            </div>
            <div className={styles.searchHint}>
              Try:{' '}
              <button type="button" onClick={() => submitSearch('Software Engineer')} className={styles.hintBtn}>
                Software Engineer
              </button>
              ,{' '}
              <button type="button" onClick={() => submitSearch('Product Manager')} className={styles.hintBtn}>
                Product Manager
              </button>
              ,{' '}
              <button type="button" onClick={() => submitSearch('Data Scientist')} className={styles.hintBtn}>
                Data Scientist
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  )
}
