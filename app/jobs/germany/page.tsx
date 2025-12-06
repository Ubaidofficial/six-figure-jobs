import { redirect } from 'next/navigation'
import { countryCodeToSlug } from '../../lib/seo/countrySlug'

export default function GermanyRedirect() {
  const slug = countryCodeToSlug('DE')
  redirect(`/jobs/country/${slug}`)
}
