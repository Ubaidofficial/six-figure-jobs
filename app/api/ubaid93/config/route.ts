import { NextResponse } from 'next/server'

import { getAdminSession } from '../../../../lib/admin/auth'
import { prisma } from '../../../../lib/prisma'
import { SPONSOR_FIELDS, SPONSOR_KEY_PREFIX, SPONSOR_SLOT_COUNT } from '../../../../lib/sponsors/slots'

export const dynamic = 'force-dynamic'

// Only the sponsor slot values can be written here. SiteConfig also holds machine state (the freehire change-feed
// cursor), which a free-form key editor could overwrite.
const EDITABLE = new Set(
  Array.from({ length: SPONSOR_SLOT_COUNT }, (_, i) => SPONSOR_FIELDS.map((f) => `${SPONSOR_KEY_PREFIX}${i + 1}.${f}`)).flat(),
)

/** Saves several values at once: { values: { "sponsor.1.name": "Acme", ... } }. */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { values?: Record<string, unknown> }
  const entries = Object.entries(body.values ?? {})
  if (entries.length === 0 || entries.some(([k, v]) => !EDITABLE.has(k) || typeof v !== 'string' || v.length > 1000)) {
    return NextResponse.json({ error: 'Only sponsor slot fields can be saved' }, { status: 400 })
  }
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.siteConfig.upsert({ where: { key }, update: { value: (value as string).trim() }, create: { key, value: (value as string).trim() } }),
    ),
  )
  return NextResponse.json({ ok: true })
}
