'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { href: '/jobs', label: 'Find $100k+ roles' },
  { href: '/salary', label: 'Salary guides' },
] as const

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="md"
          icon={<Menu className="h-5 w-5" aria-hidden="true" />}
          aria-label="Open menu"
          className="focus-ring h-11 w-11 rounded-full border border-slate-800/70 bg-slate-950/40 text-slate-200 hover:bg-slate-900/60"
        >
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="glass border-slate-800/60">
        <SheetHeader className="space-y-2 text-left">
          <SheetTitle className="text-slate-50">Six Figure Jobs</SheetTitle>
          <p className="text-sm text-slate-400">
            Premium $100k+ roles with verified salary ranges.
          </p>
        </SheetHeader>

        <nav className="mt-6 space-y-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring block rounded-xl border border-slate-800/70 bg-slate-950/40 px-4 py-3 text-sm font-medium text-slate-100 hover:bg-slate-900/60"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6">
          <Link
            href="/post-a-job"
            className="focus-ring inline-flex w-full items-center justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_40px_rgba(16,185,129,0.22)] hover:bg-emerald-300"
          >
            Hire $100k+ Talent
          </Link>
          <p className="mt-2 text-xs text-slate-500">
            Source-linked listings. Apply directly on the company site.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
