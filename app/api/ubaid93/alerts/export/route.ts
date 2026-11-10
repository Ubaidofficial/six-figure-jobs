// GET /api/ubaid93/alerts/export: confirmed, active alert subscribers as CSV (one row per alert). Admin only.
import { getAdminSession } from '../../../../../lib/admin/auth'
import { prisma } from '../../../../../lib/prisma'
import { buildAlertLabel, sanitizeAlertFilters } from '../../../../../lib/alerts/filters'
import { csvField } from '../../../../../lib/alerts/csv'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await getAdminSession())) return new Response('Unauthorized', { status: 401 })
  const rows = await prisma.jobAlert
    .findMany({
      where: { status: 'active' },
      orderBy: { confirmedAt: 'asc' },
      select: { email: true, filters: true, frequency: true, source: true, confirmedAt: true },
    })
    .catch(() => null)
  if (!rows) return new Response('Alert tables not available yet', { status: 503 })

  const lines = [
    ['email', 'alert', 'frequency', 'signed_up_on_page', 'confirmed_at'].join(','),
    ...rows.map((r) =>
      [
        r.email,
        buildAlertLabel(sanitizeAlertFilters(r.filters) ?? {}),
        r.frequency,
        r.source ?? '',
        r.confirmedAt?.toISOString() ?? '',
      ]
        .map(csvField)
        .join(','),
    ),
  ]
  return new Response(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="job-alert-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
