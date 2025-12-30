import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

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
    const { stdout, stderr } = await execFileAsync(
      'npx',
      ['tsx', 'scripts/aiEnrichJobs.ts'],
      { 
        env: process.env,
        cwd: process.cwd(),
        timeout: 1800000 // 30 minutes
      }
    )
    return NextResponse.json({ ok: true, stdout, stderr })
  } catch (e: any) {
    console.error('AI enrichment error:', e)
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || 'failed',
      stderr: e?.stderr,
      stdout: e?.stdout
    }, { status: 500 })
  }
}
