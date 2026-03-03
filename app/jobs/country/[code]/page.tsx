import { notFound, permanentRedirect } from 'next/navigation'

import { countryCodeToSlug, countrySlugToCode } from '../../../../lib/seo/countrySlug'

export const revalidate = 300

export default async function LegacyCountryRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: rawCode } = await params
  const code = rawCode.toLowerCase()

  let canonicalSlug: string | null = null

  if (code.length === 2) {
    canonicalSlug = countryCodeToSlug(code.toUpperCase())
  } else if (countrySlugToCode(code)) {
    canonicalSlug = code
  }

  if (!canonicalSlug) {
    notFound()
  }

  permanentRedirect(`/jobs/location/${canonicalSlug}`)
}
