'use client'

// The account area's tab bar on phones (owner's request, 2026-11-20: an app-like shell for auto-apply, as AIApply has):
// Swipe, Queue (the drafts waiting for review, on the swipe page), Applied (your applications) and Profile (your account).
// Hidden on wider screens, where the pages link to each other in their text. Only rendered while auto-apply is on.
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Briefcase, Layers, ListChecks, UserRound } from 'lucide-react'

import { cn } from '@/lib/utils'

import styles from './AccountTabs.module.css'

export function AccountTabs({ queueCount = 0 }: { queueCount?: number }) {
  const path = usePathname() ?? ''
  const tabs = [
    { href: '/account/swipe', label: 'Swipe', Icon: Layers, on: path === '/account/swipe' },
    { href: '/account/swipe#queue', label: 'Queue', Icon: ListChecks, on: false, badge: queueCount },
    { href: '/account/applications', label: 'Applied', Icon: Briefcase, on: path.startsWith('/account/applications') },
    { href: '/account', label: 'Profile', Icon: UserRound, on: path === '/account' || path.startsWith('/account/answers') },
  ]
  return (
    <nav className={styles.tabs} aria-label="Account">
      {tabs.map(({ href, label, Icon, on, badge }) => (
        <Link key={label} href={href} className={cn(styles.tab, on && styles.on)} aria-current={on ? 'page' : undefined}>
          <span className={styles.icon}>
            <Icon aria-hidden />
          </span>
          {label}
          {badge ? (
            <span className={styles.badge} aria-label={`${badge} waiting for review`}>
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  )
}
