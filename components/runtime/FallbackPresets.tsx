import { DataUnavailablePage } from './DataUnavailablePage'

type PresetProps = {
  title: string
  description: string
  primaryHref?: string
  primaryLabel?: string
}

const jobsCards = [
  {
    href: '/jobs/100k-plus',
    title: '$100k+ tech jobs',
    description: 'Browse the core six-figure job feed while filtered pages recover.',
  },
  {
    href: '/jobs/200k-plus',
    title: '$200k+ tech jobs',
    description: 'High-salary engineering, product, and leadership roles.',
  },
  {
    href: '/jobs/300k-plus',
    title: '$300k+ tech jobs',
    description: 'Principal, leadership, and top-comp opportunities.',
  },
  {
    href: '/jobs/400k-plus',
    title: '$400k+ executive jobs',
    description: 'Executive-track and top-band compensation pages.',
  },
]

const remoteCards = [
  {
    href: '/remote/software-engineer',
    title: 'Remote software engineering',
    description: 'Core remote software-engineer listings and filters.',
  },
  {
    href: '/remote/product-manager',
    title: 'Remote product jobs',
    description: 'Product management and strategy roles with remote eligibility.',
  },
  {
    href: '/remote/data-engineer',
    title: 'Remote data jobs',
    description: 'Data engineering and analytics roles with six-figure pay.',
  },
  {
    href: '/remote/devops-engineer',
    title: 'Remote DevOps jobs',
    description: 'Infrastructure, platform, and reliability roles.',
  },
]

export function JobsUnavailablePage({
  title,
  description,
  primaryHref = '/jobs',
  primaryLabel = 'Browse jobs',
}: PresetProps) {
  return (
    <DataUnavailablePage
      eyebrow="Live job data temporarily unavailable"
      title={title}
      description={description}
      links={[
        { href: primaryHref, label: primaryLabel, primary: true },
        { href: '/remote', label: 'Remote jobs' },
        { href: '/salary', label: 'Salary guides' },
        { href: '/companies', label: 'Companies' },
      ]}
      cards={jobsCards}
    />
  )
}

export function RemoteUnavailablePage({
  title,
  description,
  primaryHref = '/remote',
  primaryLabel = 'Browse remote jobs',
}: PresetProps) {
  return (
    <DataUnavailablePage
      eyebrow="Remote job data temporarily unavailable"
      title={title}
      description={description}
      links={[
        { href: primaryHref, label: primaryLabel, primary: true },
        { href: '/jobs', label: 'All jobs' },
        { href: '/salary', label: 'Salary guides' },
        { href: '/companies', label: 'Companies' },
      ]}
      cards={remoteCards}
    />
  )
}

export function SearchUnavailablePage({
  title,
  description,
  primaryHref = '/search',
  primaryLabel = 'Retry search',
}: PresetProps) {
  return (
    <DataUnavailablePage
      eyebrow="Search temporarily unavailable"
      title={title}
      description={description}
      links={[
        { href: primaryHref, label: primaryLabel, primary: true },
        { href: '/jobs', label: 'All jobs' },
        { href: '/remote', label: 'Remote jobs' },
        { href: '/', label: 'Home' },
      ]}
      cards={jobsCards}
    />
  )
}

export function CompanyUnavailablePage({
  title,
  description,
  primaryHref = '/companies',
  primaryLabel = 'Browse companies',
}: PresetProps) {
  return (
    <DataUnavailablePage
      eyebrow="Company data temporarily unavailable"
      title={title}
      description={description}
      links={[
        { href: primaryHref, label: primaryLabel, primary: true },
        { href: '/jobs', label: 'All jobs' },
        { href: '/remote', label: 'Remote jobs' },
        { href: '/', label: 'Home' },
      ]}
      cards={[
        {
          href: '/companies',
          title: 'Company directory',
          description: 'Browse company hubs while this page reconnects.',
        },
        ...jobsCards.slice(0, 3),
      ]}
    />
  )
}

export function JobUnavailablePage({
  title,
  description,
  primaryHref = '/jobs',
  primaryLabel = 'Browse jobs',
}: PresetProps) {
  return (
    <DataUnavailablePage
      eyebrow="Job detail temporarily unavailable"
      title={title}
      description={description}
      links={[
        { href: primaryHref, label: primaryLabel, primary: true },
        { href: '/remote', label: 'Remote jobs' },
        { href: '/companies', label: 'Companies' },
        { href: '/', label: 'Home' },
      ]}
      cards={jobsCards}
    />
  )
}
