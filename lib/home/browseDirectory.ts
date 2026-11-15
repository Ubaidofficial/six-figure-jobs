// lib/home/browseDirectory.ts
//
// The link directory at the bottom of the homepage: plain links to the pages the phase-1 sitemaps advertise, grouped
// so that every one of them has a link from the homepage. Search Console showed that about half of the sitemap pages
// (every company page, the remote role pages, the salary guides, the city and skill pages, the blog posts) had no link
// from the homepage, and that Google had found no referring page for the company pages at all.
//
// Only pages that are indexable right now are listed, by the same rules the sitemaps use: the phase-1 role list, the
// released batch-1 pSEO pages, the published (unlocked) companies and the blog posts. A test pins each rule, so a page
// that is not indexable cannot slip into this list.

import { BLOG_POSTS } from '../blog/posts'
import { roleLabelFor } from '../roles/relatedRoles'
import { PHASE_1_ROLE_SLUGS } from '../seo/indexingPhase'
import { getPseoBatch } from '../seo/pseoBatches'
import { CITY_TARGETS, SKILL_TARGETS } from '../seo/pseoTargets'

export type DirectoryLink = { href: string; label: string }
export type DirectoryGroup = { title: string; links: DirectoryLink[] }
export type DirectoryCompany = { slug: string; name: string }

/** Batch-1 senior role pages (see BATCH1_ROLES in lib/seo/pseoBatches.ts). */
export const SENIOR_ROLE_SLUGS = [
  'senior-software-engineer',
  'senior-backend-engineer',
  'senior-frontend-engineer',
  'senior-data-engineer',
] as const

const roles = [...PHASE_1_ROLE_SLUGS]

export function buildBrowseDirectory(companies: readonly DirectoryCompany[]): DirectoryGroup[] {
  const groups: DirectoryGroup[] = [
    {
      title: 'Remote jobs by role',
      links: roles.map((slug) => ({ href: `/remote/${slug}`, label: `Remote ${roleLabelFor(slug)} jobs` })),
    },
    {
      title: 'Salary guides by role',
      links: roles.map((slug) => ({ href: `/salary/${slug}`, label: `${roleLabelFor(slug)} salary` })),
    },
    {
      title: 'Senior roles',
      links: SENIOR_ROLE_SLUGS.map((slug) => ({ href: `/jobs/${slug}`, label: `${roleLabelFor(slug)} jobs` })),
    },
    {
      title: 'Jobs by city',
      links: CITY_TARGETS.filter((c) => getPseoBatch(`/jobs/city/${c.slug}`) === 1).map((c) => ({
        href: `/jobs/city/${c.slug}`,
        label: `Jobs in ${c.label}`,
      })),
    },
    {
      title: 'Jobs by skill',
      links: SKILL_TARGETS.filter((s) => getPseoBatch(`/jobs/skills/${s.slug}`) === 1).map((s) => ({
        href: `/jobs/skills/${s.slug}`,
        label: `${s.label} jobs`,
      })),
    },
    {
      title: 'Companies hiring',
      links: companies.map((c) => ({ href: `/company/${c.slug}`, label: `${c.name} jobs` })),
    },
    {
      title: 'Guides',
      links: [
        { href: '/blog', label: 'All guides' },
        ...BLOG_POSTS.map((p) => ({ href: `/blog/${p.slug}`, label: p.metaTitle ?? p.title })),
      ],
    },
  ]
  // A group with nothing to list (for example no companies when the database cannot be read) is left out.
  return groups.filter((g) => g.links.length > 0)
}
