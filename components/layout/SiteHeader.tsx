'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, Search, X } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'

import styles from './SiteHeader.module.css'

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

export function SiteHeader() {
  const scrolled = useScrolled(8)
  const router = useRouter()

  const [searchOpen, setSearchOpen] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)

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
            <Link href="/jobs" className={styles.navLink}>Jobs</Link>
            <Link href="/remote" className={styles.navLink}>Remote</Link>
            <Link href="/companies" className={styles.navLink}>Companies</Link>
            <Link href="/salary" className={styles.navLink}>Salaries</Link>
            <Link href="/blog" className={styles.navLink}>Blog</Link>
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
                    <div className={styles.mobileSectionTitle}>Browse</div>
                    <Link className={styles.mobileItem} href="/jobs" onClick={() => setMobileOpen(false)}>
                      All Jobs <span className={styles.mobileMeta}>$100k+ only</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/remote" onClick={() => setMobileOpen(false)}>
                      Remote Jobs <span className={styles.mobileMeta}>Work anywhere</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/companies" onClick={() => setMobileOpen(false)}>
                      Companies <span className={styles.mobileMeta}>Top employers</span>
                    </Link>
                  </div>

                  <div className={styles.mobileSection}>
                    <div className={styles.mobileSectionTitle}>By Salary</div>
                    <Link className={styles.mobileItem} href="/jobs/100k-plus" onClick={() => setMobileOpen(false)}>
                      💵 $100k+ jobs <span className={styles.mobileMeta}>Core six-figure</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/jobs/200k-plus" onClick={() => setMobileOpen(false)}>
                      💰 $200k+ jobs <span className={styles.mobileMeta}>Senior + staff</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/jobs/300k-plus" onClick={() => setMobileOpen(false)}>
                      💎 $300k+ jobs <span className={styles.mobileMeta}>Principal + lead</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/jobs/400k-plus" onClick={() => setMobileOpen(false)}>
                      🏆 $400k+ jobs <span className={styles.mobileMeta}>Executive band</span>
                    </Link>
                  </div>

                  <div className={styles.mobileSection}>
                    <div className={styles.mobileSectionTitle}>By Location</div>
                    <Link className={styles.mobileItem} href="/jobs/location/united-states" onClick={() => setMobileOpen(false)}>
                      🇺🇸 United States <span className={styles.mobileMeta}>$100k+ USD</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/jobs/location/united-kingdom" onClick={() => setMobileOpen(false)}>
                      🇬🇧 United Kingdom <span className={styles.mobileMeta}>£75k+ GBP</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/jobs/location/canada" onClick={() => setMobileOpen(false)}>
                      🇨🇦 Canada <span className={styles.mobileMeta}>$120k+ CAD</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/jobs/location/germany" onClick={() => setMobileOpen(false)}>
                      🇩🇪 Germany <span className={styles.mobileMeta}>€80k+ EUR</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/jobs/location/australia" onClick={() => setMobileOpen(false)}>
                      🇦🇺 Australia <span className={styles.mobileMeta}>$140k+ AUD</span>
                    </Link>
                  </div>

                  <div className={styles.mobileSection}>
                    <div className={styles.mobileSectionTitle}>More</div>
                    <Link className={styles.mobileItem} href="/salary" onClick={() => setMobileOpen(false)}>
                      Salary Guides <span className={styles.mobileMeta}>Pay benchmarks</span>
                    </Link>
                    <Link className={styles.mobileItem} href="/blog" onClick={() => setMobileOpen(false)}>
                      Career Blog <span className={styles.mobileMeta}>Tips + insights</span>
                    </Link>
                    <button
                      type="button"
                      className={styles.mobileItem}
                      onClick={() => {
                        setMobileOpen(false)
                        setSearchOpen(true)
                      }}
                    >
                      Search Jobs <span className={styles.mobileMeta}>Find roles</span>
                    </button>
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
              <button type="button" onClick={() => submitSearch('remote $200k engineer')} className={styles.hintBtn}>
                remote $200k engineer
              </button>
              ,{' '}
              <button type="button" onClick={() => submitSearch('staff engineer no degree')} className={styles.hintBtn}>
                staff engineer no degree
              </button>
              ,{' '}
              <button type="button" onClick={() => submitSearch('product manager visa sponsorship')} className={styles.hintBtn}>
                visa sponsorship PM
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  )
}
