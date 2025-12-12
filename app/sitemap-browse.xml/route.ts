// app/sitemap-browse.xml/route.ts
// Sitemap for category + location browse pages (programmatic SEO)

import { NextResponse } from 'next/server'
import { CATEGORY_LINKS, LOCATIONS } from '../page'
import {
  STATE_TARGETS,
  SKILL_TARGETS,
  INDUSTRY_TARGETS,
  CITY_TARGETS,
} from '../../lib/seo/pseoTargets'
import { getSiteUrl } from '../../lib/seo/site'

export const revalidate = 3600

const SITE_URL = getSiteUrl()

export async function GET() {
  const urls: string[] = []

  CATEGORY_LINKS.forEach((cat) => {
    urls.push(`${SITE_URL}${cat.href}`)
  })

  LOCATIONS.forEach((loc) => {
    urls.push(
      loc.code === 'remote'
        ? `${SITE_URL}/jobs/location/remote`
        : `${SITE_URL}/jobs/location/${loc.code}`,
    )
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
    urls.push(`${SITE_URL}/jobs/${roleSlug}/remote`)
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
  'senior-software-engineer',
  'staff-software-engineer',
  'product-manager',
  'data-scientist',
  'data-engineer',
  'devops',
  'backend-engineer',
  'frontend-engineer',
  'engineering-manager',
]

const TOP_CITIES = CITY_TARGETS.slice(0, 10)
const TOP_SKILLS = SKILL_TARGETS.slice(0, 15)
