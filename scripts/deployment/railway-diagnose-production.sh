#!/bin/bash
set -euo pipefail

SERVICE="${RAILWAY_SERVICE:-}"
ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"
LINES="${RAILWAY_LOG_LINES:-200}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service)
      SERVICE="${2:-}"
      shift 2
      ;;
    --environment)
      ENVIRONMENT="${2:-production}"
      shift 2
      ;;
    --lines)
      LINES="${2:-200}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--service SERVICE] [--environment ENVIRONMENT] [--lines N]" >&2
      exit 1
      ;;
  esac
done

if ! command -v railway >/dev/null 2>&1; then
  echo "Railway CLI is required. Install or make sure 'railway' is on PATH." >&2
  exit 1
fi

if ! railway whoami >/dev/null 2>&1; then
  echo "Railway CLI is not authenticated. Run: railway login" >&2
  exit 1
fi

service_args=()
if [[ -n "$SERVICE" ]]; then
  service_args+=(--service "$SERVICE")
fi

env_args=(--environment "$ENVIRONMENT")

echo "=========================================="
echo "Railway Production Diagnosis"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
if [[ -n "$SERVICE" ]]; then
  echo "Service: $SERVICE"
else
  echo "Service: linked default"
fi

echo ""
echo "== Railway Status =="
railway status --json || railway status

echo ""
echo "== Service Status =="
railway service status --all "${env_args[@]}" --json || railway service status --all "${env_args[@]}"

echo ""
echo "== Recent Deployments =="
railway deployment list "${service_args[@]}" "${env_args[@]}" --limit 5 --json || railway deployment list "${service_args[@]}" "${env_args[@]}" --limit 5

echo ""
echo "== Production Env (filtered) =="
railway variables "${service_args[@]}" "${env_args[@]}" --json | node -e '
  const fs = require("fs");
  const raw = fs.readFileSync(0, "utf8");
  const data = JSON.parse(raw);
  const keys = [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "PRISMA_CONNECTION_LIMIT",
    "PRISMA_POOL_TIMEOUT",
    "NODE_ENV"
  ];
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      out[key] = key.includes("URL") ? "[set]" : data[key];
    }
  }
  console.log(JSON.stringify(out, null, 2));
'

echo ""
echo "== Error Logs (Prisma / schema / pool filters) =="
railway logs "${service_args[@]}" "${env_args[@]}" --lines "$LINES" --filter 'Prisma OR P1001 OR P1002 OR P2024 OR "_prisma_migrations" OR "does not exist" OR "column" OR "relation"'

echo ""
echo "== Prisma Migration Status =="
railway run "${service_args[@]}" "${env_args[@]}" npx prisma migrate status --schema prisma/schema.prisma

echo ""
echo "== Prisma Schema Probe =="
railway run "${service_args[@]}" "${env_args[@]}" node scripts/deployment/railway-production-prisma-probe.mjs

cat <<'EOF'

==========================================
Remediation Commands
==========================================

If logs or the schema probe show missing tables, columns, or relations:
  railway run --environment production npx prisma migrate deploy --schema prisma/schema.prisma

If the active service is not the linked default, include it explicitly:
  railway run --service <service> --environment production npx prisma migrate deploy --schema prisma/schema.prisma

To lock the GitHub scraper to the same production database:
  1. Copy dbTarget.summary.githubVariable.value from the schema probe output above.
  2. Set GitHub repo variable PRODUCTION_DB_TARGET_FINGERPRINT to that value.
  3. Re-run the Daily Job Scraper workflow and confirm the Database Target Guard passes.

After migrations:
  railway redeploy --service <service> -y
  BASE_URL=https://www.6figjobs.com ./scripts/deployment/smoke-production.sh

If errors are P1001 / P1002 / P2024 instead of schema drift:
  1. Verify the database service is healthy in Railway.
  2. Review DATABASE_URL / POSTGRES_PRISMA_URL.
  3. Review PRISMA_CONNECTION_LIMIT and PRISMA_POOL_TIMEOUT.
  4. Re-run this diagnosis script and then the smoke check.
EOF
