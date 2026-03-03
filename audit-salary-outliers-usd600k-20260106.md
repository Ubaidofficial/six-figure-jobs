# Salary Outliers Audit — > $600,000 USD equivalent
Generated: 2026-01-06T00:56:06.005Z

## Summary
- Candidates scanned (prefiltered): 4780
- Outliers found (> $600,000 USD equiv): 435
- Outliers with salaryValidated=true: 115 (26.4%)
- Outliers flagged as too_high (salaryValidated=false & salaryParseReason=too_high): 256 (58.9%)
- Outliers computed from raw salaryMin/salaryMax (minAnnual/maxAnnual NULL): 222 (51.0%)
- Plausible legitimate $600k+ (validated, <=$1.5M, no equity/bonus terms): 88 (20.2%)
- Raw text mentions: equity=179 (41.1%), bonus/commission=101 (23.2%), OTE=2 (0.5%), hourly/monthly=63 (14.5%)
- Raw text has “big numbers” (7+ digits): 19 (4.4%)

## FX Rates
- Source: open.er-api.com (USD base)
- Note: USD equivalent computed as: `USD = localAnnual / fxRate` where fxRate is “currency units per 1 USD”.

## Top 20 Outliers
| ID | Title | Company | Salary | Currency | Source | Raw Text |
| --- | --- | --- | --- | --- | --- | --- |
| ats:greenhouse:8242613002 | Materials Management Supervisor (Starlink) | SpaceX | $9733.84M–$9733.84M/yr (A$14560.00M–A$14560.00M/yr) | AUD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8243073002 | Warehouse Supervisor (Starlink) | SpaceX | $9733.84M–$9733.84M/yr (A$14560.00M–A$14560.00M/yr) | AUD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8194803002 | Build Engineer (Super Heavy Booster) | SpaceX | $5678.72M–$5678.72M/yr (C$7800.00M–C$7800.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8194813002 | Integration Engineer (Starship) | SpaceX | $5678.72M–$5678.72M/yr (C$7800.00M–C$7800.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8193484002 | Build Supervisor (Starship) | SpaceX | $5214.56M–$5214.56M/yr (A$7800.00M–A$7800.00M/yr) | AUD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8155212002 | Structures Engineer (Starship) | SpaceX | $2839.36M–$5678.72M/yr (C$3900.00M–C$7800.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8199734002 | Test Engineer (Starship) | SpaceX | $2839.36M–$5678.72M/yr (C$3900.00M–C$7800.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8216643002 | Build Engineer, Structures (Starship) | SpaceX | $2839.36M–$5678.72M/yr (C$3900.00M–C$7800.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8217670002 | Mechanical Engineer, Mechazilla (Starship Launch Pad) | SpaceX | $2839.36M–$2839.36M/yr (C$3900.00M–C$3900.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8219645002 | Chemical Process Engineer (Starship Launch Systems) | SpaceX | $2839.36M–$2839.36M/yr (C$3900.00M–C$3900.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8229383002 | Launch Engineer, Mechanical | SpaceX | $2839.36M–$2839.36M/yr (C$3900.00M–C$3900.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8216029002 | Fluids Engineer (Starship) | SpaceX | $2839.36M–$5678.72M/yr (C$3900.00M–C$7800.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8310483002 | Launch Operations Engineer (Starship) | SpaceX | $2839.36M–$2839.36M/yr (C$3900.00M–C$3900.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8217772002 | Sr. Structural Engineer (Starship Launch Pad ) | SpaceX | $2839.36M–$2839.36M/yr (C$3900.00M–C$3900.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8216045002 | Sr. Fluids Engineer (Starship) | SpaceX | $2839.36M–$5678.72M/yr (C$3900.00M–C$7800.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8206159002 | Launch Engineer, Fluids (Starship) | SpaceX | $2839.36M–$2839.36M/yr (C$3900.00M–C$3900.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8305531002 | Launch Controls Engineer | SpaceX | $2839.36M–$2839.36M/yr (C$3900.00M–C$3900.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8217654002 | Launch Engineer, Mechanical/Fluids (Starship Launch Pad) | SpaceX | $2839.36M–$2839.36M/yr (C$3900.00M–C$3900.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8145390002 | Sr. Operations Engineer, Starship Production | SpaceX | $2839.36M–$5678.72M/yr (C$3900.00M–C$7800.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |
| ats:greenhouse:8143997002 | New Graduate Engineer, Propulsion (Starship) | SpaceX | $2839.36M–$5678.72M/yr (C$3900.00M–C$7800.00M/yr) | CAD | ats:greenhouse | &lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the st |

## Pattern Analysis
### By job.source (top 10)
| source | outliers | pct |
| --- | --- | --- |
| ats:greenhouse | 376 | 86.4% |
| ats:ashby | 57 | 13.1% |
| board:nodesk | 2 | 0.5% |

### By company (top 10)
| company | outliers | pct |
| --- | --- | --- |
| Bitpanda | 68 | 15.6% |
| SumUp | 44 | 10.1% |
| Samsara | 37 | 8.5% |
| SpaceX | 35 | 8.0% |
| Affirm | 26 | 6.0% |
| Hopper | 26 | 6.0% |
| DeepL | 24 | 5.5% |
| Asana | 20 | 4.6% |
| GitLab | 18 | 4.1% |
| Cloudflare | 15 | 3.4% |

### Salary source breakdown (Job.salarySource)
| salarySource | outliers | pct |
| --- | --- | --- |
| ats | 363 | 83.4% |
| descriptionText | 72 | 16.6% |

### Salary parse reason breakdown (Job.salaryParseReason)
| salaryParseReason | outliers | pct |
| --- | --- | --- |
| too_high | 256 | 58.9% |
| ok | 118 | 27.1% |
| bad_range | 60 | 13.8% |
| unknown_currency | 1 | 0.2% |

### Salary period breakdown (Job.salaryPeriod)
| salaryPeriod | outliers | pct |
| --- | --- | --- |
| month | 159 | 36.6% |
| year | 142 | 32.6% |
| day | 95 | 21.8% |
| week | 32 | 7.4% |
| hour | 7 | 1.6% |

### Common title keywords (top 15)
| keyword | count |
| --- | --- |
| account | 49 |
| executive | 36 |
| sales | 32 |
| platform | 22 |
| starship | 20 |
| specialist | 20 |
| customer | 19 |
| business | 19 |
| enterprise | 19 |
| technical | 18 |
| operations | 16 |
| success | 16 |
| development | 15 |
| security | 15 |
| new | 13 |

## Notes
- This report uses only DB fields; set `FETCH_PAGES=1` to also fetch and scan live job pages for salary text (best-effort).

## Page Fetch Samples (best-effort)
- Attempts: 20 (top 20)

| ID | status | found |
| --- | --- | --- |
| ats:greenhouse:8242613002 | 200 | no-salary-detected |
| ats:greenhouse:8243073002 | 200 | no-salary-detected |
| ats:greenhouse:8194803002 | 200 | no-salary-detected |
| ats:greenhouse:8194813002 | 200 | no-salary-detected |
| ats:greenhouse:8193484002 | 200 | no-salary-detected |
| ats:greenhouse:8155212002 | 200 | no-salary-detected |
| ats:greenhouse:8199734002 | 200 | no-salary-detected |
| ats:greenhouse:8217670002 | 200 | no-salary-detected |
| ats:greenhouse:8219645002 | 200 | no-salary-detected |
| ats:greenhouse:8229383002 | 200 | no-salary-detected |
| ats:greenhouse:8310483002 | 200 | no-salary-detected |
| ats:greenhouse:8216029002 | 200 | no-salary-detected |
| ats:greenhouse:8216643002 | 200 | no-salary-detected |
| ats:greenhouse:8216045002 | 200 | no-salary-detected |
| ats:greenhouse:8217772002 | 200 | no-salary-detected |
| ats:greenhouse:8206159002 | 200 | no-salary-detected |
| ats:greenhouse:8305531002 | 200 | no-salary-detected |
| ats:greenhouse:8217654002 | 200 | no-salary-detected |
| ats:greenhouse:8145390002 | 200 | no-salary-detected |
| ats:greenhouse:8143997002 | 200 | no-salary-detected |

