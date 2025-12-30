import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'node:child_process'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  return !!secret && auth === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    // Fire and forget - don't wait for completion
    const child = spawn('npx', ['tsx', 'scripts/aiEnrichJobs.ts'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
      cwd: process.cwd()
    })
    
    child.unref() // Allow parent to exit independently
    
    return NextResponse.json({ 
      ok: true, 
      message: 'AI enrichment started in background',
      pid: child.pid 
    })
  } catch (e: any) {
    console.error('AI enrichment error:', e)
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || 'failed'
    }, { status: 500 })
  }
}
