'use client'

import * as React from 'react'
import Link from '@/components/ui/Link'
import { useLinkStatus } from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, X } from 'lucide-react'

import { HeroSearchInput } from '@/components/home/HeroSearchInput'

import { AuthNav } from './AuthNav'
import { Wordmark } from './Wordmark'

import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

import styles from './SiteHeader.module.css'

/** A lime bar that sweeps under a menu link while its page loads, so a click answers at once (useLinkStatus). */
function NavPending() {
  const { pending } = useLinkStatus()
  return <span aria-hidden="true" className={pending ? `${styles.navPending} ${styles.navPendingOn}` : styles.navPending} />
}

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
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  // These pages open with their own large search box; a second one in the header read as a duplicate.
  const pageHasSearch = ['/', '/search', '/jobs', '/remote'].includes(pathname)
  const scrolled = useScrolled(8)
  const router = useRouter()

  const [mobileOpen, setMobileOpen] = React.useState(false)

  const submitSearch = React.useCallback(
    (value: string) => {
      const q = value.trim()
      if (!q) return
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
        <div className={styles.brand}>
          <Link href="/" className={styles.logo} aria-label="six fig jobs home">
            <Wordmark />
          </Link>
          <span className={styles.kicker} aria-hidden="true">
            <span className={styles.kickerStrong}>$100k+</span> salaries shown
          </span>
        </div>

        <nav className={styles.nav} aria-label="Primary">
          <Link href="/jobs" className={`${styles.navLink} ${isActive("/jobs") ? styles.navLinkActive : ''}`} aria-current={isActive("/jobs") ? 'page' : undefined}>Jobs<NavPending /></Link>
          <Link href="/remote" className={`${styles.navLink} ${isActive("/remote") ? styles.navLinkActive : ''}`} aria-current={isActive("/remote") ? 'page' : undefined}>Remote<NavPending /></Link>
          <Link href="/companies" className={`${styles.navLink} ${isActive("/companies") ? styles.navLinkActive : ''}`} aria-current={isActive("/companies") ? 'page' : undefined}>Companies<NavPending /></Link>
          <Link href="/salary" className={`${styles.navLink} ${isActive("/salary") ? styles.navLinkActive : ''}`} aria-current={isActive("/salary") ? 'page' : undefined}>Salaries<NavPending /></Link>
          <Link href="/blog" className={`${styles.navLink} ${isActive("/blog") ? styles.navLinkActive : ''}`} aria-current={isActive("/blog") ? 'page' : undefined}>Blog<NavPending /></Link>
          <AuthNav className={styles.navLink} />
        </nav>

        {/* Search on every page except the two that open with their own. Same destination as the old dialog: /search?q=... */}
        {pageHasSearch ? null : (
          <form
            role="search"
            method="get"
            action="/search"
            className={styles.search}
            onSubmit={(e) => {
              e.preventDefault()
              submitSearch(String(new FormData(e.currentTarget).get('q') ?? ''))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') (e.target as HTMLElement).blur()
            }}
          >
            <label htmlFor="site-search" className={styles.srOnly}>
              Find roles, companies, or skills
            </label>
            <Search className={styles.searchGlyph} aria-hidden="true" />
            {/* Live suggestions (roles, jobs) as you type. "/" focuses it. */}
            <HeroSearchInput
              id="site-search"
              name="q"
              className={styles.searchInput}
              placeholder="Find roles, companies, or skills"
              shortcut
              shortcutHint
            />
          </form>
        )}

        <div className={styles.right}>
          <AuthNav className={styles.mobileAuth} />
          <span className={styles.mobileOnly}>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button type="button" className={styles.hamburger} aria-label="Open menu">
                  <Menu className={styles.searchIcon} aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className={styles.mobileSheet} hideClose aria-describedby={undefined}>
                {/* Screen readers announce the open dialog by its title; the logo below is its visible heading. */}
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className={styles.mobileHeader}>
                  <Link href="/" className={styles.logo} onClick={() => setMobileOpen(false)}>
                    <Wordmark />
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
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </span>
        </div>
      </div>
    </header>
  )
}
