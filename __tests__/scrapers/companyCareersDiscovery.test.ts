import {
  classifyGenericCareerSource,
  extractCareerPageSignals,
  extractGenericJobDetail,
  findSupportedAtsFromHtml,
  hasStrongHighSalarySignal,
} from '../../lib/scrapers/utils/companyCareersDiscovery'

describe('company careers discovery utilities', () => {
  it('detects supported ATS links embedded in career pages', () => {
    const html = `
      <html>
        <body>
          <a href="https://jobs.teamtailor.com/companies/acme/jobs/123">Apply</a>
          <a href="https://jobs.lever.co/acme">View all roles</a>
        </body>
      </html>
    `

    const detected = findSupportedAtsFromHtml(html, 'https://acme.com/careers')
    expect(detected).not.toBeNull()
    expect(detected?.provider).toBe('teamtailor')
  })

  it('extracts high-salary job postings from structured data', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Staff Software Engineer",
              "url": "https://acme.com/careers/staff-software-engineer",
              "baseSalary": {
                "@type": "MonetaryAmount",
                "currency": "USD",
                "value": {
                  "@type": "QuantitativeValue",
                  "minValue": 180000,
                  "maxValue": 240000,
                  "unitText": "YEAR"
                }
              }
            }
          </script>
        </head>
        <body></body>
      </html>
    `

    const signals = extractCareerPageSignals(html, 'https://acme.com/careers')
    expect(signals.structuredJobs).toHaveLength(1)
    expect(signals.highSalarySignals).toBeGreaterThan(0)
    expect(hasStrongHighSalarySignal(signals.structuredJobs[0])).toBe(true)
  })

  it('extracts generic detail fields from job detail pages', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Principal Product Manager",
              "description": "<p>Lead a strategic area with salary of $210k - $260k per year.</p>",
              "url": "https://acme.com/jobs/principal-product-manager",
              "jobLocationType": "TELECOMMUTE",
              "baseSalary": {
                "@type": "MonetaryAmount",
                "currency": "USD",
                "value": {
                  "@type": "QuantitativeValue",
                  "minValue": 210000,
                  "maxValue": 260000,
                  "unitText": "YEAR"
                }
              }
            }
          </script>
        </head>
        <body>
          <main><h1>Principal Product Manager</h1></main>
        </body>
      </html>
    `

    const detail = extractGenericJobDetail(html, 'https://acme.com/jobs/principal-product-manager')
    expect(detail).not.toBeNull()
    expect(detail?.title).toBe('Principal Product Manager')
    expect(detail?.remote).toBe(true)
    expect(detail?.salaryMin).toBe(210000)
    expect(detail?.salaryMax).toBe(260000)
  })

  it('ignores vendor docs and asset URLs and normalizes real ATS targets', () => {
    const html = `
      <html>
        <body>
          <link rel="preload" href="https://assets-cdn.breezy.hr/favicon_192.png" />
          <a href="https://learn.greenhouse.io/">Greenhouse docs</a>
          <a href="https://nike.wd1.myworkdayjobs.com/nke/job/Metzingen-Baden-Wrttemberg/Role_R-81196/apply">
            Apply now
          </a>
        </body>
      </html>
    `

    const detected = findSupportedAtsFromHtml(html, 'https://company.example/careers')
    expect(detected).not.toBeNull()
    expect(detected?.provider).toBe('workday')
    expect(detected?.url).toBe('https://nike.wd1.myworkdayjobs.com/nke')
  })

  it('rejects offsite and non-career generic source URLs', () => {
    expect(
      classifyGenericCareerSource('https://nodesk.co', 'https://1password.com/jobs'),
    ).toMatchObject({
      valid: false,
      reason: 'blocked_host',
    })

    expect(
      classifyGenericCareerSource('https://www.atlassian.com/company', 'https://loom.com'),
    ).toMatchObject({
      valid: false,
      reason: 'offsite_host',
    })

    expect(
      classifyGenericCareerSource('https://wiz.io/', 'https://wiz.io'),
    ).toMatchObject({
      valid: false,
      reason: 'not_career_surface',
    })

    expect(
      classifyGenericCareerSource('https://careers.walmart.com/us/en/home', 'https://walmart.com'),
    ).toMatchObject({
      valid: true,
      reason: 'ok',
    })
  })
})
