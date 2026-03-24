# Deployment Documentation

## Current Production Path

Production runs on Railway. Pushes to `develop` deploy to:

```bash
https://www.6figjobs.com
```

The authoritative runbook is:

- `RAILWAY_DEPLOYMENT.md`

## Core Commands

Smoke-check production:

```bash
BASE_URL=https://www.6figjobs.com ./scripts/deployment/smoke-production.sh
```

Diagnose production database / Prisma failures:

```bash
./scripts/deployment/railway-diagnose-production.sh --environment production
```

If the app service is not the linked default:

```bash
./scripts/deployment/railway-diagnose-production.sh --service <service> --environment production
```

## Notes

- `SERVER_SETUP.md` and the legacy VPS deployment script are historical references, not the authoritative production path.
- Do not use SSH/VPS instructions for current production operations unless you are intentionally working on archived infrastructure.
