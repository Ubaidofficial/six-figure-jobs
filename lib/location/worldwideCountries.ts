// lib/location/worldwideCountries.ts
//
// The countries a "worldwide" remote job is open to, for `applicantLocationRequirements` in its JobPosting JSON-LD.
// Google says a 100% remote job must name at least one eligible country and does not cover "anywhere", so the honest
// markup for a posting that says "Worldwide" is every country: the 193 UN member states, minus the ones an employer
// cannot lawfully hire in.
//
// UN_MEMBER_STATES is the member list on https://www.un.org/en/about-us/member-states (read 2026-11-13; 193 entries,
// names as the UN writes them) with each state's ISO 3166-1 alpha-2 code. Membership changes rarely; check the page
// if a state joins.

export const UN_MEMBER_STATES: ReadonlyArray<readonly [code: string, unName: string]> = [
  ['AF', 'Afghanistan'], ['AL', 'Albania'], ['DZ', 'Algeria'], ['AD', 'Andorra'], ['AO', 'Angola'],
  ['AG', 'Antigua and Barbuda'], ['AR', 'Argentina'], ['AM', 'Armenia'], ['AU', 'Australia'], ['AT', 'Austria'],
  ['AZ', 'Azerbaijan'], ['BS', 'Bahamas (The)'], ['BH', 'Bahrain'], ['BD', 'Bangladesh'], ['BB', 'Barbados'],
  ['BY', 'Belarus'], ['BE', 'Belgium'], ['BZ', 'Belize'], ['BJ', 'Benin'], ['BT', 'Bhutan'],
  ['BO', 'Bolivia (Plurinational State of)'], ['BA', 'Bosnia and Herzegovina'], ['BW', 'Botswana'], ['BR', 'Brazil'],
  ['BN', 'Brunei Darussalam'], ['BG', 'Bulgaria'], ['BF', 'Burkina Faso'], ['BI', 'Burundi'], ['CV', 'Cabo Verde'],
  ['KH', 'Cambodia'], ['CM', 'Cameroon'], ['CA', 'Canada'], ['CF', 'Central African Republic'], ['TD', 'Chad'],
  ['CL', 'Chile'], ['CN', "China (the People's Republic of)"], ['CO', 'Colombia'], ['KM', 'Comoros'], ['CG', 'Congo'],
  ['CR', 'Costa Rica'], ['CI', "Côte D'Ivoire"], ['HR', 'Croatia'], ['CU', 'Cuba'], ['CY', 'Cyprus'], ['CZ', 'Czechia'],
  ['KP', "Democratic People's Republic of Korea"], ['CD', 'Democratic Republic of the Congo'], ['DK', 'Denmark'],
  ['DJ', 'Djibouti'], ['DM', 'Dominica'], ['DO', 'Dominican Republic'], ['EC', 'Ecuador'], ['EG', 'Egypt'],
  ['SV', 'El Salvador'], ['GQ', 'Equatorial Guinea'], ['ER', 'Eritrea'], ['EE', 'Estonia'], ['SZ', 'Eswatini'],
  ['ET', 'Ethiopia'], ['FJ', 'Fiji'], ['FI', 'Finland'], ['FR', 'France'], ['GA', 'Gabon'],
  ['GM', 'Gambia (Republic of The)'], ['GE', 'Georgia'], ['DE', 'Germany'], ['GH', 'Ghana'], ['GR', 'Greece'],
  ['GD', 'Grenada'], ['GT', 'Guatemala'], ['GN', 'Guinea'], ['GW', 'Guinea Bissau'], ['GY', 'Guyana'], ['HT', 'Haiti'],
  ['HN', 'Honduras'], ['HU', 'Hungary'], ['IS', 'Iceland'], ['IN', 'India'], ['ID', 'Indonesia'],
  ['IR', 'Iran (Islamic Republic of)'], ['IQ', 'Iraq'], ['IE', 'Ireland'], ['IL', 'Israel'], ['IT', 'Italy'],
  ['JM', 'Jamaica'], ['JP', 'Japan'], ['JO', 'Jordan'], ['KZ', 'Kazakhstan'], ['KE', 'Kenya'], ['KI', 'Kiribati'],
  ['KW', 'Kuwait'], ['KG', 'Kyrgyzstan'], ['LA', "Lao People's Democratic Republic"], ['LV', 'Latvia'],
  ['LB', 'Lebanon'], ['LS', 'Lesotho'], ['LR', 'Liberia'], ['LY', 'Libya'], ['LI', 'Liechtenstein'],
  ['LT', 'Lithuania'], ['LU', 'Luxembourg'], ['MG', 'Madagascar'], ['MW', 'Malawi'], ['MY', 'Malaysia'],
  ['MV', 'Maldives'], ['ML', 'Mali'], ['MT', 'Malta'], ['MH', 'Marshall Islands'], ['MR', 'Mauritania'],
  ['MU', 'Mauritius'], ['MX', 'Mexico'], ['FM', 'Micronesia (Federated States of)'], ['MC', 'Monaco'],
  ['MN', 'Mongolia'], ['ME', 'Montenegro'], ['MA', 'Morocco'], ['MZ', 'Mozambique'], ['MM', 'Myanmar'],
  ['NA', 'Namibia'], ['NR', 'Naoero'], ['NP', 'Nepal'], ['NL', 'Netherlands (Kingdom of the)'], ['NZ', 'New Zealand'],
  ['NI', 'Nicaragua'], ['NE', 'Niger'], ['NG', 'Nigeria'], ['MK', 'North Macedonia'], ['NO', 'Norway'], ['OM', 'Oman'],
  ['PK', 'Pakistan'], ['PW', 'Palau'], ['PA', 'Panama'], ['PG', 'Papua New Guinea'], ['PY', 'Paraguay'], ['PE', 'Peru'],
  ['PH', 'Philippines'], ['PL', 'Poland'], ['PT', 'Portugal'], ['QA', 'Qatar'], ['KR', 'Republic of Korea'],
  ['MD', 'Republic of Moldova'], ['RO', 'Romania'], ['RU', 'Russian Federation'], ['RW', 'Rwanda'],
  ['KN', 'Saint Kitts and Nevis'], ['LC', 'Saint Lucia'], ['VC', 'Saint Vincent and the Grenadines'], ['WS', 'Samoa'],
  ['SM', 'San Marino'], ['ST', 'Sao Tome and Principe'], ['SA', 'Saudi Arabia'], ['SN', 'Senegal'], ['RS', 'Serbia'],
  ['SC', 'Seychelles'], ['SL', 'Sierra Leone'], ['SG', 'Singapore'], ['SK', 'Slovakia'], ['SI', 'Slovenia'],
  ['SB', 'Solomon Islands'], ['SO', 'Somalia'], ['ZA', 'South Africa'], ['SS', 'South Sudan'], ['ES', 'Spain'],
  ['LK', 'Sri Lanka'], ['SD', 'Sudan'], ['SR', 'Suriname'], ['SE', 'Sweden'], ['CH', 'Switzerland'],
  ['SY', 'Syrian Arab Republic'], ['TJ', 'Tajikistan'], ['TH', 'Thailand'], ['TL', 'Timor-Leste'], ['TG', 'Togo'],
  ['TO', 'Tonga'], ['TT', 'Trinidad and Tobago'], ['TN', 'Tunisia'], ['TR', 'Türkiye'], ['TM', 'Turkmenistan'],
  ['TV', 'Tuvalu'], ['UG', 'Uganda'], ['UA', 'Ukraine'], ['AE', 'United Arab Emirates'],
  ['GB', 'United Kingdom of Great Britain and Northern Ireland'], ['TZ', 'United Republic of Tanzania'],
  ['US', 'United States of America'], ['UY', 'Uruguay'], ['UZ', 'Uzbekistan'], ['VU', 'Vanuatu'],
  ['VE', 'Venezuela, Bolivarian Republic of'], ['VN', 'Viet Nam'], ['YE', 'Yemen'], ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'],
]

/**
 * Countries left out of a "worldwide" job's eligible list because an employer cannot lawfully hire there: the owner's
 * call, to be confirmed with counsel or against OFAC's country list FAQ (https://ofac.treasury.gov). Cuba, Iran and North
 * Korea are the starting set. Syria, and the Crimea and other occupied regions of Ukraine (part of Ukraine here), are
 * NOT excluded until that is decided: OFAC's program page does not say which programs are comprehensive.
 */
export const WORLDWIDE_EXCLUDED_COUNTRIES: ReadonlySet<string> = new Set(['CU', 'IR', 'KP'])

/** ISO codes of the countries a worldwide remote job is open to, in the UN's order. */
export const WORLDWIDE_COUNTRY_CODES: readonly string[] = UN_MEMBER_STATES.map(([code]) => code).filter(
  (code) => !WORLDWIDE_EXCLUDED_COUNTRIES.has(code),
)
