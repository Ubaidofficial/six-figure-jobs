// lib/navigation/breadcrumbs.ts
import type { JobSlice } from '../slices/types'

export type Breadcrumb = {
  name: string
  href: string
}

function humanize(str: string): string {
  return str
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function buildSliceBreadcrumbs(slice: JobSlice): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [
    { name: 'Home', href: '/' },
  ]

  const segments = slice.slug.split('/').filter(Boolean)
  let acc = ''

  for (const segment of segments) {
    acc += '/' + segment
    crumbs.push({
      name: segment === 'jobs' ? 'Jobs' : humanize(segment),
      href: acc,
    })
  }

  return crumbs
}
