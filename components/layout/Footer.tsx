// components/layout/Footer.tsx

import Link from 'next/link'

const footerSections = [
  {
    title: '$100k+ Jobs by Role',
    links: [
      { label: '$100k+ Software Engineer Jobs', href: '/jobs/software-engineer' },
      { label: '$100k+ Product Manager Jobs', href: '/jobs/product-manager' },
      { label: '$100k+ Data Scientist Jobs', href: '/jobs/data-scientist' },
      { label: '$100k+ DevOps Engineer Jobs', href: '/jobs/devops-engineer' },
      {
        label: '$100k+ Machine Learning Engineer Jobs',
        href: '/jobs/machine-learning-engineer',
      },
      { label: 'View All Roles', href: '/jobs' },
    ],
  },
  {
    title: '$100k+ Jobs by Location',
    links: [
      { label: '$100k+ Jobs in California', href: '/jobs/state/california' },
      { label: '$100k+ Jobs in Texas', href: '/jobs/state/texas' },
      { label: '$100k+ Jobs in New York', href: '/jobs/state/new-york' },
      { label: '$100k+ Jobs in San Francisco', href: '/jobs/city/san-francisco' },
      { label: '$100k+ Remote Jobs', href: '/remote' },
      { label: 'View All Locations', href: '/jobs/state' },
    ],
  },
  {
    title: '$100k+ Jobs by Salary',
    links: [
      { label: '$100k+ Jobs', href: '/jobs/100k-plus' },
      { label: '$150k+ Jobs', href: '/jobs/150k-plus' },
      { label: '$200k+ Jobs', href: '/jobs/200k-plus' },
      { label: '$300k+ Jobs', href: '/jobs/300k-plus' },
      { label: '$400k+ Jobs', href: '/jobs/400k-plus' },
    ],
  },
  {
    title: '$100k+ Jobs by Skill',
    links: [
      { label: 'Python $100k+ Jobs', href: '/jobs/skills/python' },
      { label: 'React $100k+ Jobs', href: '/jobs/skills/react' },
      { label: 'TypeScript $100k+ Jobs', href: '/jobs/skills/typescript' },
      { label: 'AWS $100k+ Jobs', href: '/jobs/skills/aws' },
      { label: 'Kubernetes $100k+ Jobs', href: '/jobs/skills/kubernetes' },
      { label: 'View All Skills', href: '/jobs/skills' },
    ],
  },
  {
    title: '$100k+ Jobs by Industry',
    links: [
      { label: 'Fintech $100k+ Jobs', href: '/jobs/industry/fintech' },
      { label: 'AI/ML $100k+ Jobs', href: '/jobs/industry/ai-ml' },
      { label: 'SaaS $100k+ Jobs', href: '/jobs/industry/saas' },
      { label: 'Cybersecurity $100k+ Jobs', href: '/jobs/industry/cybersecurity' },
      { label: 'View All Industries', href: '/jobs/industry' },
    ],
  },
  {
    title: 'Top Companies Hiring',
    links: [
      { label: 'Google Jobs', href: '/company/google' },
      { label: 'Stripe Jobs', href: '/company/stripe' },
      { label: 'Anthropic Jobs', href: '/company/anthropic' },
      { label: 'OpenAI Jobs', href: '/company/openai' },
      { label: 'Airbnb Jobs', href: '/company/airbnb' },
      { label: 'View All Companies', href: '/companies' },
    ],
  },
  {
    title: 'Salary Guides',
    links: [
      { label: 'Software Engineer Salary', href: '/salary/software-engineer' },
      { label: 'Product Manager Salary', href: '/salary/product-manager' },
      { label: 'Data Scientist Salary', href: '/salary/data-scientist' },
      { label: 'DevOps Engineer Salary', href: '/salary/devops-engineer' },
      { label: 'View All Salary Guides', href: '/salary' },
    ],
  },
  {
    title: 'Remote $100k+ Jobs',
    links: [
      {
        label: 'Remote Software Engineer Jobs',
        href: '/jobs/software-engineer/remote',
      },
      { label: 'Remote Product Manager Jobs', href: '/jobs/product-manager/remote' },
      { label: 'Remote Data Scientist Jobs', href: '/jobs/data-scientist/remote' },
      { label: 'Work From Anywhere Jobs', href: '/remote' },
    ],
  },
  {
    title: 'For Job Seekers',
    links: [
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Job Search Tips', href: '/blog/job-search-tips' },
      { label: 'Resume Tips', href: '/blog/resume-tips' },
      { label: 'Interview Prep', href: '/blog/interview-prep' },
      { label: 'Salary Negotiation', href: '/blog/salary-negotiation' },
    ],
  },
  {
    title: 'For Employers',
    links: [
      { label: 'Post a Job', href: '/post-a-job' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Why Six Figure Jobs', href: '/why-us' },
      { label: 'Employer FAQ', href: '/faq#employers' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press Kit', href: '/press' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Report a Problem', href: '/report' },
      { label: 'Feature Requests', href: '/feedback' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'DMCA', href: '/dmca' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#0A0A0A] pt-16 pb-8">
      <div className="container mx-auto px-4">
        {/* Footer Grid - Responsive */}
        <div className="mb-14 grid grid-cols-2 gap-10 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {footerSections.map((section) => (
            <div key={section.title} className="footer-column">
              <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="focus-ring inline-flex rounded-md text-sm text-slate-400 underline-offset-4 transition-colors hover:text-emerald-300 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer Bottom */}
        <div className="border-t border-slate-800/80 pt-8">
          <p className="text-center text-xs text-slate-400 md:text-left">
            ✅ Free for job seekers • 🛡️ Source-linked listings • ↗️ Apply direct
          </p>

          <div className="mt-6 flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Six Figure Jobs. All rights reserved.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-2">
              <a
                href="https://twitter.com/6figjobs"
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-emerald-300"
                aria-label="Follow us on Twitter"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>

              <a
                href="https://linkedin.com/company/sixfigjobs"
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-emerald-300"
                aria-label="Follow us on LinkedIn"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
