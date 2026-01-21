import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const fp = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const x = req.headers.get("x-cron-secret") ?? "";
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRET_NEXT].filter(Boolean) as string[];

  const bearer = auth.replace(/^Bearer\s+/i, "");
  const match =
    secrets.some((s) => auth === `Bearer ${s}`) ||
    secrets.includes(bearer) ||
    secrets.includes(x);

  return NextResponse.json({
    hasAuthorization: !!auth,
    authorizationLen: auth.length,
    authorizationFp: auth ? fp(auth) : null,
    hasXCronSecret: !!x,
    xCronSecretLen: x.length,
    xCronSecretFp: x ? fp(x) : null,
    secretsCount: secrets.length,
    secretsFp: secrets.map(fp),
    match,
  });
}
