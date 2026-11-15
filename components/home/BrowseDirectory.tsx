// More links for the homepage's "Popular Six Figure Job Searches" directory (lib/home/browseDirectory.ts says which pages
// and why). Plain links in the same quiet style as the rest of that block. Server component.
import Link from '@/components/ui/Link'
import { buildBrowseDirectory, type DirectoryCompany } from '@/lib/home/browseDirectory'

export function BrowseDirectory({ companies }: { companies: readonly DirectoryCompany[] }) {
  const groups = buildBrowseDirectory(companies)
  return (
    <div className="mt-8 grid gap-x-8 gap-y-6 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 font-medium text-foreground">{group.title}</h3>
          <ul className="space-y-1.5">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
