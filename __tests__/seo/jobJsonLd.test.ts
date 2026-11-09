import { buildJobJsonLd } from '../../lib/seo/jobJsonLd'

describe('buildJobJsonLd', () => {
  it('sets a future validThrough and preserves cleaned HTML descriptions', () => {
    const lastSeenAt = new Date('2026-03-20T00:00:00.000Z')

    const jsonLd = buildJobJsonLd({
      id: 'ats:test:1',
      title: 'Senior Software Engineer',
      company: 'Acme',
      companyLogo: null,
      locationRaw: 'New York, US',
      city: 'New York',
      citySlug: 'new-york',
      countryCode: 'US',
      remote: false,
      remoteRegion: null,
      remoteMode: 'onsite',
      salaryRaw: null,
      descriptionHtml:
        "<script>alert(1)</script><p>Acme's Job Applicant Privacy Notice</p><p>Personal Information We Collect</p><p>Your Privacy Choices</p><p>Build platform systems.</p><ul><li>Own backend services.</li></ul>",
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: 'USD',
      salaryPeriod: 'year',
      minAnnual: BigInt(180000),
      maxAnnual: BigInt(220000),
      currency: 'USD',
      isHighSalary: true,
      isHundredKLocal: true,
      isHighSalaryLocal: true,
      type: 'Full-time',
      source: 'greenhouse',
      applyUrl: 'https://jobs.example.com/apply',
      url: 'https://jobs.example.com/role',
      roleSlug: 'software-engineer',
      skillsJson: null,
      requirementsJson: null,
      benefitsJson: null,
      externalId: '1',
      isExpired: false,
      lastSeenAt,
      postedAt: new Date('2026-03-15T00:00:00.000Z'),
      createdAt: new Date('2026-03-15T00:00:00.000Z'),
      updatedAt: new Date('2026-03-20T00:00:00.000Z'),
      companyId: null,
      locationId: null,
      dedupeKey: null,
      sourcePriority: 20,
      isUnverifiedBoardJob: false,
      experienceLevel: 'senior',
      employmentType: 'full-time',
      workArrangement: null,
      visaSponsorship: false,
      techStack: null,
      industry: null,
      stateCode: 'NY',
      shortId: null,
      aiSummaryJson: null,
      aiSnippet: null,
      aiOneLiner: null,
      aiEnrichedAt: null,
      locationsJson: null,
      primaryLocation: null,
      aiBenefits: null,
      aiRequirements: null,
      aiWhyHighPay: null,
      aiModel: null,
      aiVersion: null,
      aiQualityScore: null,
      lastAiEnrichedAt: null,
      salaryConfidence: 90,
      salaryValidated: true,
      salarySource: 'ats',
      salaryParseReason: null,
      salaryNormalizedAt: null,
      salaryRejectedAt: null,
      salaryRejectedReason: null,
      needsReview: false,
      workArrangementNormalized: null,
      companyRef: {
        id: 'company-1',
        name: 'Acme',
        slug: 'acme',
        website: 'https://acme.com',
        logoUrl: 'https://acme.com/logo.png',
        description: null,
        linkedinUrl: null,
        sizeBucket: null,
        tagsJson: null,
        fundingSummary: null,
        industry: null,
        atsProvider: null,
        atsUrl: null,
        atsSlug: null,
        lastScrapedAt: null,
        scrapeStatus: null,
        scrapeError: null,
        jobCount: 0,
        totalJobCount: null,
        lastJobCountSyncAt: null,
        countryCode: 'US',
        headquarters: null,
        employeeCount: null,
        fundingStage: null,
        foundedYear: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-20T00:00:00.000Z'),
      },
    } as any)

    expect(jsonLd['@type']).toBe('JobPosting')
    expect(new Date(jsonLd.validThrough).getTime()).toBeGreaterThan(Date.now())
    expect(new Date(jsonLd.validThrough).getTime()).toBeGreaterThan(
      new Date(jsonLd.datePosted).getTime(),
    )
    expect(jsonLd.description).toContain('<p>Build platform systems.</p>')
    expect(jsonLd.description).toContain('<li>Own backend services.</li>')
    expect(jsonLd.description).not.toContain('<script>')
    expect(jsonLd.description).not.toMatch(/privacy notice|personal information we collect|privacy choices/i)
    expect(jsonLd.employmentType).toBe('FULL_TIME')
    expect(jsonLd.jobLocation.address.addressCountry).toBe('US')
  })

  it('marks fully remote roles with TELECOMMUTE and applicant location requirements', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:2',
      title: 'Remote Product Manager',
      company: 'Acme',
      companyLogo: null,
      locationRaw: null,
      city: null,
      citySlug: null,
      countryCode: 'CA',
      remote: true,
      remoteRegion: null,
      remoteMode: 'remote',
      salaryRaw: null,
      descriptionHtml: '<p>Lead distributed product execution.</p>',
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      minAnnual: null,
      maxAnnual: null,
      currency: null,
      isHighSalary: false,
      isHundredKLocal: false,
      isHighSalaryLocal: false,
      type: null,
      source: 'greenhouse',
      applyUrl: null,
      url: null,
      roleSlug: 'product-manager',
      skillsJson: null,
      requirementsJson: null,
      benefitsJson: null,
      externalId: '2',
      isExpired: false,
      lastSeenAt: null,
      postedAt: new Date('2026-03-15T00:00:00.000Z'),
      createdAt: new Date('2026-03-15T00:00:00.000Z'),
      updatedAt: new Date('2026-03-20T00:00:00.000Z'),
      companyId: null,
      locationId: null,
      dedupeKey: null,
      sourcePriority: 20,
      isUnverifiedBoardJob: false,
      experienceLevel: null,
      employmentType: null,
      workArrangement: null,
      visaSponsorship: false,
      techStack: null,
      industry: null,
      stateCode: null,
      shortId: null,
      aiSummaryJson: null,
      aiSnippet: null,
      aiOneLiner: null,
      aiEnrichedAt: null,
      locationsJson: null,
      primaryLocation: null,
      aiBenefits: null,
      aiRequirements: null,
      aiWhyHighPay: null,
      aiModel: null,
      aiVersion: null,
      aiQualityScore: null,
      lastAiEnrichedAt: null,
      salaryConfidence: 0,
      salaryValidated: false,
      salarySource: null,
      salaryParseReason: null,
      salaryNormalizedAt: null,
      salaryRejectedAt: null,
      salaryRejectedReason: null,
      needsReview: false,
      workArrangementNormalized: null,
      companyRef: null,
    } as any)

    expect(jsonLd.jobLocationType).toBe('TELECOMMUTE')
    expect(jsonLd.jobLocation).toBeUndefined()
    expect(jsonLd.applicantLocationRequirements).toEqual({
      '@type': 'Country',
      name: 'Canada',
    })
  })

  it('infers applicant location requirements from remote location text', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:3',
      title: 'Remote Data Engineer',
      company: 'Acme',
      companyLogo: null,
      locationRaw: 'Remote (US)',
      city: null,
      citySlug: null,
      countryCode: null,
      remote: true,
      remoteRegion: null,
      remoteMode: 'remote',
      salaryRaw: null,
      descriptionHtml: '<p>Build data platforms remotely.</p>',
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      minAnnual: null,
      maxAnnual: null,
      currency: null,
      isHighSalary: false,
      isHundredKLocal: false,
      isHighSalaryLocal: false,
      type: null,
      source: 'greenhouse',
      applyUrl: null,
      url: null,
      roleSlug: 'data-engineer',
      skillsJson: null,
      requirementsJson: null,
      benefitsJson: null,
      externalId: '3',
      isExpired: false,
      lastSeenAt: null,
      postedAt: new Date('2026-03-15T00:00:00.000Z'),
      createdAt: new Date('2026-03-15T00:00:00.000Z'),
      updatedAt: new Date('2026-03-20T00:00:00.000Z'),
      companyId: null,
      locationId: null,
      dedupeKey: null,
      sourcePriority: 20,
      isUnverifiedBoardJob: false,
      experienceLevel: null,
      employmentType: null,
      workArrangement: null,
      visaSponsorship: false,
      techStack: null,
      industry: null,
      stateCode: null,
      shortId: null,
      aiSummaryJson: null,
      aiSnippet: null,
      aiOneLiner: null,
      aiEnrichedAt: null,
      locationsJson: null,
      primaryLocation: null,
      aiBenefits: null,
      aiRequirements: null,
      aiWhyHighPay: null,
      aiModel: null,
      aiVersion: null,
      aiQualityScore: null,
      lastAiEnrichedAt: null,
      salaryConfidence: 0,
      salaryValidated: false,
      salarySource: null,
      salaryParseReason: null,
      salaryNormalizedAt: null,
      salaryRejectedAt: null,
      salaryRejectedReason: null,
      needsReview: false,
      workArrangementNormalized: null,
      companyRef: null,
    } as any)

    expect(jsonLd.jobLocationType).toBe('TELECOMMUTE')
    expect(jsonLd.applicantLocationRequirements).toEqual({
      '@type': 'Country',
      name: 'United States',
    })
    expect(jsonLd.jobLocation).toBeUndefined()
  })

  it('emits TELECOMMUTE when remote geography is unknown', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:4',
      title: 'Remote Platform Engineer',
      company: 'Acme',
      companyLogo: null,
      locationRaw: 'Remote',
      city: null,
      citySlug: null,
      countryCode: null,
      remote: true,
      remoteRegion: null,
      remoteMode: 'remote',
      salaryRaw: null,
      descriptionHtml: '<p>Operate platform systems remotely.</p>',
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      minAnnual: null,
      maxAnnual: null,
      currency: null,
      isHighSalary: false,
      isHundredKLocal: false,
      isHighSalaryLocal: false,
      type: null,
      source: 'greenhouse',
      applyUrl: null,
      url: null,
      roleSlug: 'platform',
      skillsJson: null,
      requirementsJson: null,
      benefitsJson: null,
      externalId: '4',
      isExpired: false,
      lastSeenAt: null,
      postedAt: new Date('2026-03-15T00:00:00.000Z'),
      createdAt: new Date('2026-03-15T00:00:00.000Z'),
      updatedAt: new Date('2026-03-20T00:00:00.000Z'),
      companyId: null,
      locationId: null,
      dedupeKey: null,
      sourcePriority: 20,
      isUnverifiedBoardJob: false,
      experienceLevel: null,
      employmentType: null,
      workArrangement: null,
      visaSponsorship: false,
      techStack: null,
      industry: null,
      stateCode: null,
      shortId: null,
      aiSummaryJson: null,
      aiSnippet: null,
      aiOneLiner: null,
      aiEnrichedAt: null,
      locationsJson: null,
      primaryLocation: null,
      aiBenefits: null,
      aiRequirements: null,
      aiWhyHighPay: null,
      aiModel: null,
      aiVersion: null,
      aiQualityScore: null,
      lastAiEnrichedAt: null,
      salaryConfidence: 0,
      salaryValidated: false,
      salarySource: null,
      salaryParseReason: null,
      salaryNormalizedAt: null,
      salaryRejectedAt: null,
      salaryRejectedReason: null,
      needsReview: false,
      workArrangementNormalized: null,
      companyRef: null,
    } as any)

    expect(jsonLd.jobLocationType).toBe('TELECOMMUTE')
    expect(jsonLd.applicantLocationRequirements).toBeUndefined()
    expect(jsonLd.jobLocation).toBeUndefined()
  })

  it('omits baseSalary if salary is not validated', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:5',
      title: 'Software Engineer',
      salaryMin: 100000,
      salaryMax: 150000,
      salaryCurrency: 'USD',
      minAnnual: BigInt(100000),
      maxAnnual: BigInt(150000),
      currency: 'USD',
      salaryValidated: false,
    } as any)

    expect(jsonLd.baseSalary).toBeUndefined()
  })

  it('includes baseSalary if salary is validated', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:6',
      title: 'Software Engineer',
      salaryMin: 100000,
      salaryMax: 150000,
      salaryCurrency: 'USD',
      minAnnual: BigInt(100000),
      maxAnnual: BigInt(150000),
      currency: 'USD',
      salaryValidated: true,
    } as any)

    expect(jsonLd.baseSalary).toBeDefined()
    expect(jsonLd.baseSalary.value.minValue).toBe(100000)
    expect(jsonLd.baseSalary.value.maxValue).toBe(150000)
    expect(jsonLd.baseSalary.currency).toBe('USD')
  })

  it('omits maxValue if salaryMax and maxAnnual are missing', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:7',
      title: 'Software Engineer',
      salaryMin: 100000,
      minAnnual: BigInt(100000),
      currency: 'USD',
      salaryValidated: true,
    } as any)

    expect(jsonLd.baseSalary).toBeDefined()
    expect(jsonLd.baseSalary.value.minValue).toBe(100000)
    expect(jsonLd.baseSalary.value.maxValue).toBeUndefined()
  })

  it('correctly formats baseSalary for hourly rates', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:8',
      title: 'Hourly Worker',
      salaryMin: 50,
      salaryMax: 75,
      salaryPeriod: 'hourly',
      currency: 'USD',
      salaryValidated: true,
    } as any)

    expect(jsonLd.baseSalary).toBeDefined()
    expect(jsonLd.baseSalary.value.minValue).toBe(50)
    expect(jsonLd.baseSalary.value.maxValue).toBe(75)
    expect(jsonLd.baseSalary.value.unitText).toBe('HOUR')
  })

  it('never claims directApply — candidates apply on the employer site', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:9',
      title: 'Staff Engineer',
      applyUrl: 'https://jobs.example.com/apply',
    } as any)

    expect(jsonLd).not.toHaveProperty('directApply')
  })

  it('omits employmentType when it is unknown instead of guessing FULL_TIME', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:10',
      title: 'Staff Engineer',
      type: null,
      employmentType: null,
    } as any)

    expect(jsonLd).not.toHaveProperty('employmentType')
  })

  it('omits employmentType when the value is not a recognised schema.org enum', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:11',
      title: 'Staff Engineer',
      type: 'Regular',
    } as any)

    expect(jsonLd).not.toHaveProperty('employmentType')
  })

  it.each(['FullTime', 'Full-time', 'full_time', 'FULL_TIME'])(
    'maps the %s spelling to FULL_TIME',
    (type) => {
      const jsonLd = buildJobJsonLd({ id: 'ats:test:13', title: 'Staff Engineer', type } as any)
      expect(jsonLd.employmentType).toBe('FULL_TIME')
    },
  )

  it('maps recognised employment types to schema.org enums', () => {
    const jsonLd = buildJobJsonLd({
      id: 'ats:test:12',
      title: 'Staff Engineer',
      type: 'Contract',
    } as any)

    expect(jsonLd.employmentType).toBe('CONTRACTOR')
  })

  describe('jobLocation', () => {
    const base = {
      id: 'board:freehire:1',
      title: 'Senior Staff Software Engineer, Ads Content Safety AI/ML',
      company: 'Google',
      companyRef: null,
      remote: false,
      remoteMode: null,
      city: null,
      countryCode: 'US',
      stateCode: null,
      descriptionHtml: '<p>Build things.</p>',
      salaryValidated: false,
      source: 'board:freehire',
      applyUrl: 'https://careers.example.com/1',
      postedAt: new Date('2026-11-02T00:00:00.000Z'),
      createdAt: new Date('2026-11-02T00:00:00.000Z'),
      lastSeenAt: new Date('2026-11-04T00:00:00.000Z'),
    }

    it('emits one Place per workplace when the location lists several, separated by semicolons', () => {
      const ld = buildJobJsonLd({ ...base, locationRaw: 'Los Angeles, CA, USA; Mountain View, CA, USA' } as any)
      expect(ld.jobLocation).toEqual([
        { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Los Angeles', addressRegion: 'CA', addressCountry: 'US' } },
        { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Mountain View', addressRegion: 'CA', addressCountry: 'US' } },
      ])
    })

    it('reads each place\'s own country, falling back to the job\'s', () => {
      const ld = buildJobJsonLd({ ...base, locationRaw: 'Toronto, ON, Canada; Austin, TX' } as any)
      expect(ld.jobLocation.map((p: any) => p.address.addressCountry)).toEqual(['CA', 'US'])
    })

    it('keeps a single Place for a single location, and for a job with a city', () => {
      const one = buildJobJsonLd({ ...base, locationRaw: 'Austin, TX, USA' } as any)
      expect(Array.isArray(one.jobLocation)).toBe(false)
      const withCity = buildJobJsonLd({ ...base, city: 'Austin', locationRaw: 'Austin, TX; Remote' } as any)
      expect(Array.isArray(withCity.jobLocation)).toBe(false)
    })

    describe('addressRegion of a single place (jobs have no stateCode, so it is read from the location text)', () => {
      const address = (over: Record<string, unknown>) => buildJobJsonLd({ ...base, ...over } as any).jobLocation.address

      it.each([
        ['Maryville, TN, USA', 'Maryville', 'TN'],
        ['North Bethesda, MD', 'North Bethesda', 'MD'],
        ['East Syracuse, NY, US, 13057-0278', 'East Syracuse', 'NY'],
        ['Irvine, California, United States', 'Irvine', 'CA'],
        ['Troy, Michigan, United States', 'Troy', 'MI'],
        ['Washington, DC', 'Washington', 'DC'],
      ])('%s', (locationRaw, city, region) => {
        expect(address({ locationRaw, city })).toMatchObject({ addressLocality: city, addressRegion: region, addressCountry: 'US' })
      })

      it('reads a Canadian province for a Canadian job', () => {
        expect(address({ locationRaw: 'Toronto, ON, Canada', city: 'Toronto', countryCode: 'CA' })).toMatchObject({ addressRegion: 'ON', addressCountry: 'CA' })
      })

      it('does not read a US state from another country\'s text ("DE" is Germany, "IN" is India, "CA" is Canada)', () => {
        expect(address({ locationRaw: 'Berlin, DE', city: 'Berlin', countryCode: 'DE' }).addressRegion).toBeUndefined()
        expect(address({ locationRaw: 'Pune, IN', city: 'Pune', countryCode: 'IN' }).addressRegion).toBeUndefined()
        expect(address({ locationRaw: 'Calgary, CA', city: 'Calgary', countryCode: 'CA' }).addressRegion).toBeUndefined()
      })

      it('adds nothing when the text names no state', () => {
        expect(address({ locationRaw: 'Boston', city: 'Boston' }).addressRegion).toBeUndefined()
        expect(address({ locationRaw: 'Austin, USA', city: 'Austin' }).addressRegion).toBeUndefined()
      })

      it('puts a state named as the whole location in addressRegion, not addressLocality', () => {
        expect(address({ locationRaw: 'Iowa' })).toEqual({ '@type': 'PostalAddress', addressRegion: 'IA', addressCountry: 'US' })
      })

      it('keeps "New York" and "Washington" alone as places, since they are cities as often as states', () => {
        expect(address({ locationRaw: 'New York' })).toMatchObject({ addressLocality: 'New York' })
        expect(address({ locationRaw: 'New York' }).addressRegion).toBeUndefined()
        expect(address({ locationRaw: 'Washington' })).toMatchObject({ addressLocality: 'Washington' })
      })

      it('lets a stored stateCode win', () => {
        expect(address({ locationRaw: 'Maryville, TN', city: 'Maryville', stateCode: 'ca' }).addressRegion).toBe('CA')
      })
    })
  })
})
