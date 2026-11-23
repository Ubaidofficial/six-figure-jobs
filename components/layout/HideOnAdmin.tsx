'use client'
// The public header, footer and feedback tab are not shown inside the admin console (/ubaid93), which has its own
// navigation. Everywhere else this renders its children unchanged, so public pages' server HTML is the same.
import { usePathname } from 'next/navigation'

export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  if (pathname === '/ubaid93' || pathname.startsWith('/ubaid93/')) return null
  return <>{children}</>
}
