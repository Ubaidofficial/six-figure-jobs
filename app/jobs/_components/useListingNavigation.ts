'use client'

import { useCallback, useEffect, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Changes a listing page's filters in the URL. The navigation runs in a transition, and while it is pending
 * `<html data-listing-pending>` is set, which dims the results (Listing.module.css): a click used to change the list
 * with no sign that anything was happening. The page number is always dropped, since the result set changes.
 */
export function useListingNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!pending) return
    const root = document.documentElement
    root.dataset.listingPending = '1'
    return () => {
      delete root.dataset.listingPending
    }
  }, [pending])

  const update = useCallback(
    (updater: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString())
      updater(next)
      next.delete('page')
      const qs = next.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams],
  )

  return { pending, update, searchParams }
}
