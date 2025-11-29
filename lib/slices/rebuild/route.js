// app/api/slices/rebuild/route.js

import { NextResponse } from 'next/server'
import { rebuildAllSlices } from '../../../../lib/slices/rebuild'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const summary = await rebuildAllSlices()

    return NextResponse.json({
      ok: true,
      ...summary,
    })
  } catch (err) {
    console.error('[slices/rebuild] Error rebuilding slices', err)
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to rebuild slices',
      },
      { status: 500 },
    )
  }
}
