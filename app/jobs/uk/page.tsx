import { redirect } from 'next/navigation'
import { countryCodeToSlug } from '../../lib/seo/countrySlug'

export default function UKRedirect() {
  const slug = countryCodeToSlug('GB')
  redirect(`/jobs/country/${slug}`)
}
