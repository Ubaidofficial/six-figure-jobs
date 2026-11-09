// Footer links in one place, rendered by both the desktop columns and the mobile accordions, and checked by
// __tests__/guards/internalLinks.test.ts against the routes that exist. Only link to pages that exist and are not redirects.

export type FooterLink = readonly [label: string, href: string]
export type FooterColumn = { title: string; links: readonly FooterLink[] }

const location = (name: string, slug: string): FooterLink => [name, `/jobs/location/${slug}`]
const guide = (name: string, slug: string): FooterLink => [`${name} Salary`, `/salary/${slug}`]

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Jobs',
    links: [
      ['All Jobs', '/jobs'],
      ['New Jobs', '/jobs?sort=recent'],
      ['Remote Jobs', '/remote'],
      ['Top Companies', '/companies'],
      ['$100k+ Jobs', '/jobs/100k-plus'],
      ['$200k+ Jobs', '/jobs/200k-plus'],
      ['$300k+ Jobs', '/jobs/300k-plus'],
      ['$400k+ Jobs', '/jobs/400k-plus'],
    ],
  },
  {
    title: 'Remote Jobs',
    links: [
      ['Worldwide', '/remote?remoteRegion=global'],
      ['United States', '/remote?remoteRegion=us-only'],
      ['Canada', '/remote?remoteRegion=canada'],
      ['Europe', '/remote?remoteRegion=europe'],
      ['Australia', '/remote?remoteRegion=australia'],
    ],
  },
  {
    title: 'By Location',
    links: [
      location('United States', 'united-states'),
      location('United Kingdom', 'united-kingdom'),
      location('Canada', 'canada'),
      location('Germany', 'germany'),
      location('Australia', 'australia'),
      location('Netherlands', 'netherlands'),
      location('Ireland', 'ireland'),
      location('Spain', 'spain'),
      location('France', 'france'),
      location('Singapore', 'singapore'),
    ],
  },
  {
    title: 'Popular Roles',
    links: [
      ['Software Engineer', '/jobs/software-engineer'],
      ['Senior Software Engineer', '/jobs/senior-software-engineer'],
      ['Full-Stack Engineer', '/jobs/full-stack-engineer'],
      ['Data Scientist', '/jobs/data-scientist'],
      ['Machine Learning Engineer', '/jobs/machine-learning-engineer'],
      ['Product Manager', '/jobs/product-manager'],
      ['Account Executive', '/jobs/account-executive'],
      ['Engineering Manager', '/jobs/engineering-manager'],
      ['Product Designer', '/jobs/product-designer'],
    ],
  },
  {
    title: 'Salary Guides',
    links: [
      ['All Salary Guides', '/salary'],
      guide('Software Engineer', 'software-engineer'),
      guide('Data Scientist', 'data-scientist'),
      guide('Product Manager', 'product-manager'),
      guide('Account Executive', 'account-executive'),
      guide('Engineering Manager', 'engineering-manager'),
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Career Blog', '/blog'],
      ['Visa Sponsorship Jobs', '/jobs/visa-sponsorship'],
      ['No-Degree Tech Jobs', '/jobs/no-degree'],
      ['Senior-Level Jobs', '/jobs/level/senior'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About Us', '/about'],
      ['Contact', '/about#contact'],
      ['Privacy Policy', '/privacy'],
      ['Terms of Service', '/terms'],
      ['Cookie Policy', '/cookies'],
    ],
  },
]
