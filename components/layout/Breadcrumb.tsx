import NextLink from '@/components/ui/Link'

import { cn } from '@/lib/utils'

/** Visible breadcrumb. Pages keep emitting their own BreadcrumbList JSON-LD; the two must list the same trail. */
export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-nowrap items-center text-sm text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={item.label} className={cn('flex items-center', last ? 'min-w-0 flex-1' : 'shrink-0')}>
              {i > 0 ? (
                <span aria-hidden="true" className="mx-2 text-muted-foreground/60">
                  ›
                </span>
              ) : null}
              {item.href && !last ? (
                <NextLink href={item.href} className="hover:text-foreground hover:underline underline-offset-4">
                  {item.label}
                </NextLink>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn(last && 'truncate text-foreground')}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
