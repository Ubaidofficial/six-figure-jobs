// app/api/debug/ats/route.js

import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const prisma = new PrismaClient()
const companyClient = prisma.company
const jobClient = prisma.job

export async function GET() {
  try {
    // 1) Get all companies that have an ATS provider
    const companies = await companyClient.findMany({
      where: {
        atsProvider: { not: null },
      },
      select: {
        id: true,
        name: true,
        atsProvider: true,
        atsUrl: true,
      },
    })

    // Group companies by atsProvider
    const groups = {}
    for (const c of companies) {
      const provider = c.atsProvider || 'unknown'
      if (!groups[provider]) groups[provider] = []
      groups[provider].push(c)
    }

    const providers = Object.keys(groups)

    // 2) For each provider, get jobCount for companies using that ATS
    const results = await Promise.all(
      providers.map(async (provider) => {
        const companyIds = groups[provider].map((c) => String(c.id))

        let jobCount = 0
        if (companyIds.length > 0) {
          jobCount = await jobClient.count({
            where: {
              companyId: { in: companyIds },
            },
          })
        }

        return {
          provider,
          companyCount: groups[provider].length,
          jobCount,
          companies: groups[provider],
        }
      }),
    )

    return NextResponse.json({
      ok: true,
      providers: results,
    })
  } catch (err) {
    console.error('[debug/ats] Error:', err)
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load ATS debug overview',
      },
      { status: 500 },
    )
  }
}
