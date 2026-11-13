// lib/location/regionCountries.ts
//
// Country lists for two region words that remote job texts use but REMOTE_REGIONS (lib/jobs/remoteRegions.ts) does not
// have: adding them there would add chips and filters to the /remote and listing pages. Used only for the JobPosting
// JSON-LD of a remote job whose text says "North America" or "Americas".

/**
 * "North America" in a US job board's posting nearly always means the US and Canada. Mexico is geographically in North
 * America but rarely what the employer means; add 'MX' here if that should change.
 */
export const NORTH_AMERICA_REMOTE: readonly string[] = ['US', 'CA']

/** "Americas": the 35 UN member states of North, Central and South America and the Caribbean. */
export const AMERICAS: readonly string[] = [
  'AG', 'AR', 'BS', 'BB', 'BZ', 'BO', 'BR', 'CA', 'CL', 'CO', 'CR', 'CU', 'DM', 'DO', 'EC', 'SV', 'GD', 'GT', 'GY', 'HT',
  'HN', 'JM', 'MX', 'NI', 'PA', 'PY', 'PE', 'KN', 'LC', 'VC', 'SR', 'TT', 'US', 'UY', 'VE',
]
