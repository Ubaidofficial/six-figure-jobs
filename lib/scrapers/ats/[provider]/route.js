// app/api/debug/ats/[provider]/route.js

import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const prisma = new PrismaClient()
const companyClient = prisma.company
const jobClient = prisma.job

export async function GET(_req, { params }) {
  const provider = params?.provider

  if (!provider) {
    return NextResponse.json(
      { ok: false, error: 'Missing ATS provider in path' },
      { status: 400 },
    )
  }

  try {
    const companies = await companyClient.findMany({
      where: {
        atsProvider: provider,
      },
      orderBy: {
        name: 'asc',
      },
    })

    if (!companies.length) {
      return NextResponse.json({
        ok: true,
        provider,
        companies: [],
        message: 'No companies found for this provider',
      })
    }

    const details = []

    for (const company of companies) {
      const companyId = String(company.id)

      const jobs = await jobClient.findMany({
        where: { companyId },
        orderBy: { postedAt: 'desc' },
        take: 50,
      })

      const totalJobs = jobs.length
      const activeJobs = jobs.filter((j) => j.isExpired === false).length
      const expiredJobs = jobs.filter((j) => j.isExpired === true).length

      let lastSeenAt = null
      for (const j of jobs) {
        if (j.lastSeenAt && (!lastSeenAt || j.lastSeenAt > lastSeenAt)) {
          lastSeenAt = j.lastSeenAt
        }
      }

      details.push({
        companyId,
        name: company.name,
        atsProvider: company.atsProvider,
        atsUrl: company.atsUrl,
        stats: {
          totalJobs,
          activeJobs,
          expiredJobs,
          lastSeenAt,
        },
        sampleJobs: jobs.slice(0, 5).map((j) => ({
          id: j.id,
          title: j.title,
          url: j.url,
          isExpired: j.isExpired ?? null,
          postedAt: j.postedAt ?? null,
          lastSeenAt: j.lastSeenAt ?? null,
          externalId: j.externalId ?? null,
        })),
      })
    }

    return NextResponse.json({
      ok: true,
      provider,
      companies: details,
    })
  } catch (err) {
    console.error('[debug/ats/[provider]] Error:', err)
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load ATS provider debug info',
      },
      { status: 500 },
    )
  }
}
