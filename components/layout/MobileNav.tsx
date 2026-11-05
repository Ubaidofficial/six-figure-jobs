'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { href: '/jobs', label: 'Find six-figure roles' },
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
          className="focus-ring h-11 w-11 rounded-full border border-border bg-card text-foreground hover:bg-card"
        >
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="glass border-border">
        <SheetHeader className="space-y-2 text-left">
          <SheetTitle className="text-foreground">Six Figure Jobs</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Premium six-figure roles with verified salary ranges.
          </p>
        </SheetHeader>

        <nav className="mt-6 space-y-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring block rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-card"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 text-xs text-muted-foreground">
          Source-linked listings. Apply directly on the company site.
        </p>
      </SheetContent>
    </Sheet>
  )
}
