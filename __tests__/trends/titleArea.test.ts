import { TITLE_AREAS, TITLE_AREA_LABELS, areaOfTitle, type TitleArea } from '../../lib/trends/titleArea'

// Real titles from the live listings (2026-11-22), with the area each should read as. The rules are an ordered list, so most of
// these pin an ORDER decision (a specific phrase beating a general word): see the comments on the groups.
const CASES: Array<[string, TitleArea | null]> = [
  // Plain engineering, and a team after the role does not change it.
  ['Senior Software Engineer', 'engineering'],
  ['Site Reliability Engineer', 'engineering'],
  ['Engineering Manager, Integrations', 'engineering'],
  ['Senior Director, Software Engineering', 'engineering'],
  ['Software Engineer, Finance Systems', 'engineering'],
  ['Manager, Software Engineering', 'engineering'],
  ['Professional Civil Engineer', 'engineering'],
  ['Senior Forward Deployed Engineer', 'engineering'],
  ['Member of Technical Staff (Migrations)', 'engineering'],
  ['Enterprise Architect - Principal', 'engineering'],
  ['Solutions Architect', 'engineering'], // as often internal IT as pre-sales, so not Sales
  ['Linux System Administrator – Mid Level (TS/SCI)', 'engineering'],
  ['Microsoft 365 Security Manager', 'engineering'],
  ['Principal Security Operations Analyst, Security Operations Center', 'engineering'], // "security operations" is not Operations
  // An employer in front of the title is dropped, but a team after a comma is not an employer.
  ['CircleCI: Staff Software Engineer, On-Prem', 'engineering'],
  ['ZoomInfo Technologies LLC: Principal Software Engineer', 'engineering'],
  ['Senior Staff SRE, Architecture Engineering: Hosted Runners', 'engineering'],
  // Sales: an engineer in sales is Sales; a technical account manager is Customer.
  ['Senior Account Executive', 'sales'],
  ['Sales Engineer', 'sales'],
  ['Elation Health: Sales Engineer - Billing', 'sales'],
  ['Presales Solutions Engineer (GRC)', 'sales'],
  ['Territory Manager (Nebraska)', 'sales'],
  ['Head of Channel (LATAM)', 'sales'],
  ['Enterprise Business Development Representative', 'sales'],
  ['Account Exec Enterprise Accounts', 'sales'],
  ['Key Account Manager', 'sales'],
  ['Manager, Sales Compensation', 'sales'], // not People: "compensation" alone is not a People word
  ['Senior Technical Account Manager (Federal)', 'customer'],
  ['Senior Customer Success Manager', 'customer'],
  ['Glean: Designated Technical Support Engineer - Central/East', 'customer'], // a support engineer is Customer, not Engineering
  ['Mid-Market Implementation Specialist - EMEA', 'customer'],
  // Data & AI before Engineering ("Data Engineer"), and the first part of a title decides.
  ['Senior Data Scientist', 'data'],
  ['Data Engineer', 'data'],
  ['Machine Learning Engineer', 'data'],
  ['Analytics Engineer', 'data'],
  ['Senior Data Analyst', 'data'],
  ['Research Scientist (Open Benchmarks Red Team)', 'data'],
  ['Dropbox: Director, Data Science & Engineering, Finance', 'data'], // the trailing team (Finance) does not win
  // Product and Design: a designer is not a product role although "product" is in the title.
  ['Senior Product Manager', 'product'],
  ['Technical Product Manager', 'product'],
  ['Group Product Manager, Data Feeds', 'product'],
  ['Upstart: Director of Product, Machine Learning & Decisioning Platforms', 'product'],
  ['Senior Manager - Technical Product Owner - Treasury', 'product'], // Treasury is the team
  ['Lead/Principal Product Designer (Dealmakers)', 'design'],
  ['Senior Head of Product Design', 'design'],
  ['UX Designer', 'design'],
  ['Manager, Product Design', 'design'],
  // Marketing: "product marketing" is Marketing.
  ['Senior Product Marketing Manager (Platform AI)', 'marketing'],
  ['Lifecycle Marketing Manager', 'marketing'],
  ['Senior Paid Media Manager', 'marketing'],
  ['Head of Copy', 'marketing'],
  ['Vice President of Growth', 'marketing'],
  // Operations, Finance, People, Legal, Healthcare.
  ['Senior Technical Program Manager, Cloud Security', 'operations'],
  ['Chief of Staff', 'operations'],
  ['Procurement Manager', 'operations'],
  ['Sr. Manager, Supply Chain (Network Infrastructure)', 'operations'],
  ['Manager, Program and Project Management', 'operations'],
  ['Senior Project Manager- Healthcare IT & Compliance', 'operations'], // not Legal: "compliance" comes after the operations words
  ['Senior Accountant', 'finance'],
  ['Director, Treasury & Tax', 'finance'],
  ['Senior Technical Recruiter', 'people'],
  ['Principal Talent Acquisition Partner (GTM)', 'people'],
  ['Benefits Partner', 'people'],
  ['General Counsel', 'legal'],
  ['Director of Compliance', 'legal'],
  ['Primary Care Nurse Practitioner', 'healthcare'],
  ['Dentist', 'healthcare'],
  ['Principal Perfusionist - Pediatrics - San Francisco', 'healthcare'],
  ['Facharzt für Urologie (m/w/d)', 'healthcare'],
  ['Assistenzärztin Arbeitsmedizin (m/w/d) Albstadt - Weiterbildung zur Fachärztin für Arbeitsmedizin', 'healthcare'],
  // Found on a second set of unseen titles (2026-11-22): the order of the rules matters here.
  ['Staff/Principal Software Quality Engineer', 'engineering'], // an engineer is Engineering although "quality" is an Operations word
  ['Supply Chain ALM Software Engineer Manager', 'engineering'],
  ['Senior Process Engineer', 'engineering'],
  ['Senior Data Product Manager', 'product'], // not Data: Product comes before Data
  ['Applied AI Product Manager - Financial Services/Audit', 'product'],
  ['Senior FP&A Manager, GTM', 'finance'], // "&" is read as "and"
  ['Manager, Incident Response', 'engineering'],
  ['Associate Director Digital Forensics & Incident Management', 'engineering'],
  ['Director, Observability Architects (Americas) | USA | Remote', 'engineering'],
  ['Chief Technology Officer', 'engineering'],
  ['Sr. Patient Navigator', 'healthcare'],
  ['Mid-Level Litigation Associate', 'legal'],
  ['Director, Regulatory Affairs', 'legal'],
  ['Technical Program Manager', 'operations'], // no engineer word: stays Operations
  // No rule is sure: left out rather than guessed.
  ['Strategic Partner', null],
  ['Administrator', null],
  ['Security Renewals Specialist', null], // a renewals role, not security engineering
  ['Travel Security Senior Manager', null],
  ['Leiter Einkauf - Strategisch & Operativ (m/w/d)', null],
  ['', null],
]

describe('areaOfTitle', () => {
  it.each(CASES)('%s -> %s', (title, area) => {
    expect(areaOfTitle(title)).toBe(area)
  })

  it('reads nothing from a missing title', () => {
    expect(areaOfTitle(null)).toBeNull()
    expect(areaOfTitle(undefined)).toBeNull()
    expect(areaOfTitle('   ')).toBeNull()
  })

  it('does not depend on case or punctuation', () => {
    expect(areaOfTitle('SR MGR, DATA SCIENCE')).toBe('data')
    expect(areaOfTitle('sales   engineer!!')).toBe('sales')
  })

  it('has a label for every area, and the areas are unique', () => {
    expect(new Set(TITLE_AREAS).size).toBe(TITLE_AREAS.length)
    for (const a of TITLE_AREAS) expect(TITLE_AREA_LABELS[a]).toBeTruthy()
  })
})
