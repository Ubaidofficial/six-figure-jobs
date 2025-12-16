import Link from 'next/link'

const footerSections = [
  {
    title: '$100k+ Jobs by Role',
    links: [
      { label: 'Software Engineer Jobs', href: '/jobs/software-engineer' },
      { label: 'Product Manager Jobs', href: '/jobs/product-manager' },
      { label: 'Data Scientist Jobs', href: '/jobs/data-scientist' },
      { label: 'DevOps Engineer Jobs', href: '/jobs/devops-engineer' },
      { label: 'View all roles', href: '/jobs' },
    ],
  },
  {
    title: 'Jobs by Salary',
    links: [
      { label: '$100k+ Jobs', href: '/jobs/100k-plus' },
      { label: '$200k+ Jobs', href: '/jobs/200k-plus' },
      { label: '$300k+ Jobs', href: '/jobs/300k-plus' },
      { label: '$400k+ Jobs', href: '/jobs/400k-plus' },
    ],
  },
  {
    title: 'Jobs by Skill',
    links: [
      { label: 'Python Jobs', href: '/jobs/skills/python' },
      { label: 'React Jobs', href: '/jobs/skills/react' },
      { label: 'AWS Jobs', href: '/jobs/skills/aws' },
      { label: 'TypeScript Jobs', href: '/jobs/skills/typescript' },
      { label: 'All skills', href: '/jobs/skills' },
    ],
  },
  {
    title: 'Top Companies',
    links: [
      { label: 'Google Jobs', href: '/company/google' },
      { label: 'Stripe Jobs', href: '/company/stripe' },
      { label: 'OpenAI Jobs', href: '/company/openai' },
      { label: 'Airbnb Jobs', href: '/company/airbnb' },
      { label: 'All companies', href: '/companies' },
    ],
  },
  {
    title: 'Remote $100k+ Jobs',
    links: [
      { label: 'Remote Software Engineer', href: '/remote/software-engineer' },
      { label: 'Remote Product Manager', href: '/remote/product-manager' },
      { label: 'Remote Data Scientist', href: '/remote/data-scientist' },
      { label: 'All remote jobs', href: '/remote' },
    ],
  },
  {
    title: 'Company',
    links: [{ label: 'About Six Figure Jobs', href: '/about' }],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#0A0A0A] pb-8 pt-16">
      <div className="container mx-auto px-4">
        <div className="mb-14 grid grid-cols-2 gap-10 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex rounded-md text-sm text-slate-400 underline-offset-4 transition-colors hover:text-emerald-300 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800/80 pt-8">
          <p className="max-w-3xl text-xs text-slate-400">
            Six Figure Jobs is a curated job board featuring verified roles that
            typically pay $100k+ (or local equivalent). We link directly to
            original job postings so you can apply with confidence.
          </p>

          <div className="mt-6 flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Six Figure Jobs. All rights reserved.
            </p>

            <div className="flex items-center gap-2">
              <a
                href="https://twitter.com/6figjobs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Six Figure Jobs on Twitter"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-emerald-300"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>

              <a
                href="https://linkedin.com/company/sixfigjobs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Six Figure Jobs on LinkedIn"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-emerald-300"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
