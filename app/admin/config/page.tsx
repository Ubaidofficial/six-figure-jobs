import { prisma } from '../../../lib/prisma'
import ConfigEditor from './ConfigEditor'

const DEFAULT_CONFIGS = [
  { key: 'homepage.headline', label: 'Homepage Headline', value: '$100k+ Remote Jobs. Salaries Upfront.' },
  { key: 'homepage.subtitle', label: 'Homepage Subtitle', value: 'Curated high-paying remote roles at top companies. Every listing shows the full salary range.' },
  { key: 'homepage.badge', label: 'Homepage Badge Text', value: '100K+ JOBS' },
  { key: 'banner.text', label: 'Announcement Banner (leave empty to hide)', value: '' },
  { key: 'banner.link', label: 'Announcement Banner Link', value: '' },
  { key: 'footer.tagline', label: 'Footer Tagline', value: 'The job board for six-figure remote careers.' },
  { key: 'seo.siteDescription', label: 'Site Meta Description', value: 'Discover $100k+ remote jobs with salaries published upfront. No recruiter middlemen.' },
]

export default async function ConfigPage() {
  const saved = await prisma.siteConfig.findMany()
  const savedMap = Object.fromEntries(saved.map((c) => [c.key, c]))

  const configs = DEFAULT_CONFIGS.map((d) => ({
    ...d,
    value: savedMap[d.key]?.value ?? d.value,
  }))

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Site Config</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Edit website copy. Changes take effect on next page load.</p>
      <ConfigEditor configs={configs} />
    </div>
  )
}
