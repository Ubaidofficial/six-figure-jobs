import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere } from '../../../../lib/jobs/queryJobs'

export const dynamic = 'force-dynamic'

export async function GET() {
  const activeWhere = { isExpired: false as const }
  const eligibleWhere = {
    isExpired: false,
    AND: [buildGlobalExclusionsWhere(), buildHighSalaryEligibilityWhere()],
  }

  const [totalActive, totalEligible, enrichedActive, enrichedEligible] = await Promise.all([
    prisma.job.count({ where: activeWhere }),
    prisma.job.count({ where: eligibleWhere }),
    prisma.job.count({ where: { ...activeWhere, aiEnrichedAt: { not: null } } }),
    prisma.job.count({ where: { ...eligibleWhere, aiEnrichedAt: { not: null } } }),
  ])

  const pct = (n: number, d: number) => (d ? Number(((n / d) * 100).toFixed(1)) : 0)

  return NextResponse.json({
    totalActive,
    enrichedActive,
    enrichedActivePct: pct(enrichedActive, totalActive),
    totalEligible,
    enrichedEligible,
    enrichedEligiblePct: pct(enrichedEligible, totalEligible),
  })
}
