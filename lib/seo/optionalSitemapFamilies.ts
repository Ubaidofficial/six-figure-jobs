import { getCitySitemapUrls } from './citySitemap'
import { hasCountrySitemapEntries } from './countrySitemap'
import { hasRemoteRoleSitemapEntries } from './remoteSitemap'
import { hasSliceSitemapEntries } from './slicesSitemap'

type OptionalFamilyKey = 'city' | 'remote' | 'country' | 'slices'

type OptionalFamilyState = {
  cityUrls: Awaited<ReturnType<typeof getCitySitemapUrls>>
  hasRemoteUrls: boolean
  hasCountryUrls: boolean
  hasSliceUrls: boolean
  failedFamilies: OptionalFamilyKey[]
}

function resolveSettledValue<T>(
  routeTag: string,
  family: OptionalFamilyKey,
  result: PromiseSettledResult<T>,
  fallbackValue: T,
): { value: T; failed: boolean } {
  if (result.status === 'fulfilled') {
    return { value: result.value, failed: false }
  }

  console.error(`[${routeTag}] fallback_used=1 optional_family=${family}`, result.reason)

  return { value: fallbackValue, failed: true }
}

export async function resolveOptionalSitemapFamilies(
  routeTag: string,
): Promise<OptionalFamilyState> {
  const [cityResult, remoteResult, countryResult, slicesResult] = await Promise.allSettled([
    getCitySitemapUrls(),
    hasRemoteRoleSitemapEntries(),
    hasCountrySitemapEntries(),
    hasSliceSitemapEntries(),
  ])

  const city = resolveSettledValue(routeTag, 'city', cityResult, [])
  const remote = resolveSettledValue(routeTag, 'remote', remoteResult, false)
  const country = resolveSettledValue(routeTag, 'country', countryResult, false)
  const slices = resolveSettledValue(routeTag, 'slices', slicesResult, false)

  return {
    cityUrls: city.value,
    hasRemoteUrls: remote.value,
    hasCountryUrls: country.value,
    hasSliceUrls: slices.value,
    failedFamilies: [
      ...(city.failed ? ['city' as const] : []),
      ...(remote.failed ? ['remote' as const] : []),
      ...(country.failed ? ['country' as const] : []),
      ...(slices.failed ? ['slices' as const] : []),
    ],
  }
}
