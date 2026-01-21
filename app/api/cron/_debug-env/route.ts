import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function info(v?: string) {
  return { present: !!v, len: v ? v.length : 0 };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  return NextResponse.json({
    ok: true,
    authPresent: !!auth,
    authLen: auth.length,
    CRON_SECRET: info(process.env.CRON_SECRET),
    CRON_SECRET_NEXT: info(process.env.CRON_SECRET_NEXT),
    AI_ENRICHMENT_PAUSED: process.env.AI_ENRICHMENT_PAUSED ?? null,
  });
}
