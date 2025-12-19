// app/sitemap-browse.xml/route.ts
// Sitemap for category + location browse pages (programmatic SEO)

import { NextResponse } from 'next/server'
import { CATEGORY_LINKS } from '@/lib/constants/category-links'
import { LOCATIONS } from '@/lib/constants/homepage'
import {
  STATE_TARGETS,
  SKILL_TARGETS,
  INDUSTRY_TARGETS,
  CITY_TARGETS,
} from '../../lib/seo/pseoTargets'

const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://www.6figjobs.com'

export const revalidate = 3600

export async function GET() {
  const urls: string[] = []

  CATEGORY_LINKS.roles.forEach((cat) => {
    urls.push(`${SITE_URL}${cat.href}`)
  })
  CATEGORY_LINKS.locations.forEach((cat) => {
    urls.push(`${SITE_URL}${cat.href}`)
  })
  CATEGORY_LINKS.salaryTiers.forEach((cat) => {
    urls.push(`${SITE_URL}${cat.href}`)
  })

  LOCATIONS.forEach((loc) => {
    if (loc.code === 'remote') {
      // /jobs/location/remote redirects; include canonical remote landing instead
      urls.push(`${SITE_URL}/remote`)
      return
    }

    urls.push(`${SITE_URL}/jobs/location/${loc.code}`)
  })

  STATE_TARGETS.forEach((state) => {
    urls.push(`${SITE_URL}/jobs/state/${state.slug}`)
  })

  SKILL_TARGETS.forEach((skill) => {
    urls.push(`${SITE_URL}/jobs/skills/${skill.slug}`)
  })

  INDUSTRY_TARGETS.forEach((industry) => {
    urls.push(`${SITE_URL}/jobs/industry/${industry.slug}`)
  })

  CITY_TARGETS.forEach((city) => {
    urls.push(`${SITE_URL}/jobs/city/${city.slug}`)
  })
  // Add industry landing pages
  INDUSTRY_TARGETS.forEach((industry) => {
    urls.push(`${SITE_URL}/jobs/industry/${industry.slug}`)
  })

  // Combo routes: role + remote
  TOP_ROLE_SLUGS.forEach((roleSlug) => {
    // /jobs/[role]/remote redirects; include canonical remote role page instead
    urls.push(`${SITE_URL}/remote/${roleSlug}`)
    TOP_CITIES.forEach((city) => {
      urls.push(`${SITE_URL}/jobs/${roleSlug}/city/${city.slug}`)
    })
  })

  // Combo routes: skill + remote
  TOP_SKILLS.forEach((skill) => {
    urls.push(`${SITE_URL}/jobs/skills/${skill.slug}/remote`)
    TOP_ROLE_SLUGS.forEach((roleSlug) => {
      urls.push(`${SITE_URL}/jobs/${roleSlug}/skills/${skill.slug}`)
    })
  })

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u}</loc>
    <changefreq>daily</changefreq>
  </url>`,
  )
  .join('\n')}
</urlset>`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
const TOP_ROLE_SLUGS = [
  'software-engineer',
  'product-manager',
  'data-scientist',
  'data-engineer',
  'backend-engineer',
  'frontend-engineer',
  'full-stack-engineer',
  'devops-engineer',
  'machine-learning-engineer',
  'engineering-manager',
]

const TOP_CITIES = CITY_TARGETS.slice(0, 10)
const TOP_SKILLS = SKILL_TARGETS.slice(0, 15)
