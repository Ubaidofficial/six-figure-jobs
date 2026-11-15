// lib/research/payReportCharts.ts
//
// The three charts other sites can embed (as PNG images, route: /high-paying-jobs-report/<edition>/chart/<name>). The page's
// embed previews and the image route both read this, so the picture and the page cannot disagree.
import { MIN_ROLE_LISTINGS, PAY_REPORT_PATH, editionPath, usd, type PayReportData } from './payReport'

export const PAY_REPORT_CHART_NAMES = ['bands', 'seniority', 'roles'] as const
export type PayReportChartName = (typeof PAY_REPORT_CHART_NAMES)[number]

export type ChartBar = { label: string; valueText: string; /** 0 to 100, relative to the largest bar. */ pct: number }
export type PayReportChart = { name: PayReportChartName; title: string; subtitle: string; alt: string; bars: ChartBar[] }

const ROLE_BARS = 8

function scale<T>(items: T[], value: (x: T) => number, label: (x: T) => string, text: (x: T) => string): ChartBar[] {
  const max = Math.max(...items.map(value), 1)
  return items.map((x) => ({ label: label(x), valueText: text(x), pct: Math.round((100 * value(x)) / max) }))
}

export const isChartName = (name: string): name is PayReportChartName => (PAY_REPORT_CHART_NAMES as readonly string[]).includes(name)

export function payReportChart(r: PayReportData, name: PayReportChartName): PayReportChart {
  switch (name) {
    case 'bands':
      return {
        name,
        title: 'Six-figure job listings by advertised salary',
        subtitle: `Share of ${r.headline.allListings.toLocaleString('en-US')} listings by advertised midpoint, ${r.month}`,
        alt: `Share of six-figure job listings by advertised salary band, ${r.month}`,
        bars: scale(r.bands, (b) => b.pct, (b) => b.label.replace(/,000/g, 'k').replace(/,999/g, 'k').replace(' to ', ' – '), (b) => `${b.pct.toFixed(1)}%`),
      }
    case 'seniority':
      return {
        name,
        title: 'Median advertised pay by seniority',
        subtitle: `Median advertised midpoint, six-figure listings, ${r.month}`,
        alt: `Median advertised pay by seniority level for six-figure jobs, ${r.month}`,
        bars: scale([...r.seniority].reverse(), (s) => s.median, (s) => s.label, (s) => usd(s.median)),
      }
    case 'roles':
      return {
        name,
        title: 'Best-paid six-figure roles',
        subtitle: `Median advertised midpoint, roles with ${MIN_ROLE_LISTINGS}+ listings, ${r.month}`,
        alt: `Best-paid six-figure roles by median advertised pay, ${r.month}`,
        bars: scale(r.roles.slice(0, ROLE_BARS), (x) => x.median, (x) => x.label, (x) => usd(x.median)),
      }
  }
}

export const chartPath = (r: Pick<PayReportData, 'slug'>, name: PayReportChartName): string => `${editionPath(r)}/chart/${name}`

/** The HTML a site pastes to show the chart and credit the report. `siteUrl` has no trailing slash. */
export function chartEmbedHtml(r: PayReportData, name: PayReportChartName, siteUrl: string): string {
  const c = payReportChart(r, name)
  return `<a href="${siteUrl}${PAY_REPORT_PATH}"><img src="${siteUrl}${chartPath(r, name)}" alt="${c.alt} (Six Figure Jobs)" width="1200" height="675"></a>`
}
