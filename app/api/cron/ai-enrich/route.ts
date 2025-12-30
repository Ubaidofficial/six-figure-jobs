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
    console.log('[ai-enrich-api] Starting AI enrichment process...')
    
    // Fire and forget - don't wait for completion
    const child = spawn('npx', ['tsx', 'scripts/aiEnrichJobs.ts'], {
      detached: true,
      stdio: ['ignore', 'inherit', 'inherit'], // Log stdout/stderr to Railway
      env: process.env,
      cwd: process.cwd()
    })
    
    child.unref() // Allow parent to exit independently
    
    console.log(`[ai-enrich-api] Background process started with PID: ${child.pid}`)
    
    return NextResponse.json({ 
      ok: true, 
      message: 'AI enrichment started in background',
      pid: child.pid 
    })
  } catch (e: any) {
    console.error('[ai-enrich-api] Failed to start process:', e)
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || 'failed'
    }, { status: 500 })
  }
}
