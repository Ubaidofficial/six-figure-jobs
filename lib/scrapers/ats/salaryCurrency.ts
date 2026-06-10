import { inferCurrencyFromCountryCode } from '../../normalizers/salary'

type CurrencyOptions = {
  locationText?: string | null
  countryCode?: string | null
}

const CANADA_PROVINCES = /\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/i
const US_STATES =
  /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY|DC)\b/i

export function inferCurrencyFromLocation(options: CurrencyOptions): string | null {
  const countryCurrency = inferCurrencyFromCountryCode(options.countryCode)
  if (countryCurrency) return countryCurrency

  const rawLocation = String(options.locationText ?? '').trim()
  if (!rawLocation) return null

  const location = rawLocation
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (/\b(canada|toronto|vancouver|montreal|ottawa|calgary|edmonton|waterloo|kitchener|mississauga|ontario|british columbia|quebec|alberta)\b/.test(location)) {
    return 'CAD'
  }
  if (/(?:^|[,\s])(?:AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)(?:$|[,\s])/i.test(rawLocation)) {
    return 'CAD'
  }

  if (/\b(australia|sydney|melbourne|brisbane|perth|adelaide|canberra|new south wales|victoria|queensland)\b/.test(location)) {
    return 'AUD'
  }
  if (/(?:^|[,\s])(?:NSW|VIC|QLD|WA|SA|TAS|ACT)(?:$|[,\s])/i.test(rawLocation)) {
    return 'AUD'
  }

  if (/\b(new zealand|auckland|wellington)\b/.test(location)) return 'NZD'
  if (/\b(singapore)\b/.test(location)) return 'SGD'
  if (/\b(united kingdom|london|england|scotland|wales|northern ireland|uk)\b/.test(location)) {
    return 'GBP'
  }
  if (/\b(germany|france|netherlands|spain|italy|ireland|portugal|austria|belgium|finland|luxembourg|berlin|paris|amsterdam|madrid|barcelona|dublin|lisbon)\b/.test(location)) {
    return 'EUR'
  }
  if (/\b(switzerland|zurich|geneva)\b/.test(location)) return 'CHF'
  if (/\b(sweden|stockholm)\b/.test(location)) return 'SEK'
  if (/\b(norway|oslo)\b/.test(location)) return 'NOK'
  if (/\b(denmark|copenhagen)\b/.test(location)) return 'DKK'

  if (/\b(united states|usa|u\.s\.|remote\s+us|remote\s+usa|us\s+remote)\b/.test(location)) {
    return 'USD'
  }
  const usStateMatch = rawLocation.match(US_STATES)
  if (usStateMatch && !CANADA_PROVINCES.test(rawLocation)) {
    const state = usStateMatch[1]?.toUpperCase()
    if (
      state === 'CA' &&
      !/\b(san francisco|los angeles|san diego|san jose|palo alto|mountain view|menlo park|oakland|california|united states|usa|u\.s\.)\b/i.test(rawLocation)
    ) {
      return null
    }
    return 'USD'
  }

  return null
}

export function inferCurrencyFromSalaryText(
  text: string | null | undefined,
  options: CurrencyOptions = {},
): string | null {
  const value = String(text ?? '')
  const upper = value.toUpperCase()

  if (upper.includes('EUR') || value.includes('€')) return 'EUR'
  if (upper.includes('GBP') || value.includes('£')) return 'GBP'
  if (upper.includes('CAD') || /\bC\$|\bCA\$/i.test(value)) return 'CAD'
  if (upper.includes('AUD') || /\bA\$|\bAU\$/i.test(value)) return 'AUD'
  if (upper.includes('NZD') || /\bNZ\$/i.test(value)) return 'NZD'
  if (upper.includes('SGD') || /\bS\$|\bSG\$/i.test(value)) return 'SGD'
  if (upper.includes('CHF')) return 'CHF'
  if (upper.includes('SEK')) return 'SEK'
  if (upper.includes('NOK')) return 'NOK'
  if (upper.includes('DKK')) return 'DKK'
  if (upper.includes('USD') || /\bUS\$/i.test(value)) return 'USD'
  if (value.includes('$')) return inferCurrencyFromLocation(options)

  return null
}
