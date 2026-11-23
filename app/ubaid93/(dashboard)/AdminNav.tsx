'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  BellRing,
  Bot,
  Briefcase,
  Bug,
  LayoutGrid,
  Megaphone,
  MessageSquareText,
  MousePointerClick,
} from 'lucide-react'

import s from '../admin.module.css'

type Item = { href: string; label: string; icon: typeof Activity; count?: 'feedback' | 'errors' }

const GROUPS: Array<{ label: string; items: Item[] }> = [
  {
    label: 'Monitor',
    items: [
      { href: '/ubaid93', label: 'Overview', icon: LayoutGrid },
      { href: '/ubaid93/system', label: 'System', icon: Activity },
      { href: '/ubaid93/errors', label: 'Errors', icon: Bug, count: 'errors' },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/ubaid93/jobs', label: 'Jobs', icon: Briefcase },
      { href: '/ubaid93/sponsors', label: 'Sponsors', icon: Megaphone },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/ubaid93/feedback', label: 'Feedback', icon: MessageSquareText, count: 'feedback' },
      { href: '/ubaid93/alerts', label: 'Job alerts', icon: BellRing },
      { href: '/ubaid93/clicks', label: 'Apply clicks', icon: MousePointerClick },
      { href: '/ubaid93/autoapply', label: 'Auto-apply', icon: Bot },
    ],
  },
]

export default function AdminNav({ counts }: { counts: { feedback: number; errors: number } }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()

  async function logout() {
    await fetch('/api/ubaid93/logout', { method: 'POST' })
    router.push('/ubaid93/login')
    router.refresh()
  }

  return (
    <aside className={s.sidebar}>
      <Link href="/ubaid93" className={s.brand}>
        <span className={s.brandMark} aria-hidden>
          6
        </span>
        <span className={s.brandName}>
          Six Figure Jobs
          <span className={s.brandSub}>Admin</span>
        </span>
      </Link>
      <nav className={s.navScroll} aria-label="Admin">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div className={s.navGroup}>{g.label}</div>
            {g.items.map(({ href, label, icon: Icon, count }) => {
              const active = href === '/ubaid93' ? pathname === href : pathname.startsWith(href)
              const n = count ? counts[count] : 0
              return (
                <Link key={href} href={href} className={s.navLink} aria-current={active ? 'page' : undefined}>
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                  {label}
                  {n > 0 ? (
                    <span className={s.navCount} aria-label={`${n} new`}>
                      {n > 999 ? '999+' : n}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className={s.sidebarFoot}>
        <a className={s.footLink} href="/" target="_blank" rel="noopener">
          Open the site ↗
        </a>
        <button type="button" className={s.footLink} onClick={logout}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
