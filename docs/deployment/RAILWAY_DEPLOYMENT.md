# Six Figure Jobs — Railway Deployment

## Status
**Authoritative infrastructure: Railway**  
Legacy VPS / Hetzner documentation is deprecated and archived.

This document defines how production is deployed, operated, and verified on Railway.

---

## 1) Environment

### Production
- Platform: Railway
- Branch: `develop`
- Deployment: automatic on push to `develop`
- URL: `https://www.6figjobs.com`

There is no staging environment. Every deploy affects production directly, so schema safety and smoke checks are mandatory.

---

## 2) Railway Build / Release Steps

### Build command
```bash
npm install
npx prisma migrate deploy
npm run build
```

`prisma migrate deploy` is a required production step. Do not rely on app startup or manual console work to apply schema changes after code has already shipped.

### Runtime command
Use the normal Next.js production start command configured for Railway.

---

## 3) Required Production Env

Set these explicitly in Railway:

- `DATABASE_URL` or `POSTGRES_PRISMA_URL`
- `PRISMA_CONNECTION_LIMIT`
- `PRISMA_POOL_TIMEOUT`

`PRISMA_CONNECTION_LIMIT` and `PRISMA_POOL_TIMEOUT` must be treated as production config, not hidden defaults. Review them whenever listing pages, scraper concurrency, or Prisma fan-out changes.

---

## 4) Post-Deploy Smoke Check

Run the production smoke script immediately after each deploy:

```bash
BASE_URL=https://www.6figjobs.com ./scripts/deployment/smoke-production.sh
```

The smoke check validates these critical routes:

- `/`
- `/jobs`
- `/jobs/100k-plus`
- `/jobs/200k-plus`
- `/jobs/300k-plus`
- `/jobs/400k-plus`
- `/remote`
- `/remote/software-engineer`

The script fails when it detects:

- non-2xx/3xx responses
- Next.js server-side digest crash output
- temporary fallback banners, which means live data is still unavailable

---

## 5) Release Rule

If production errors indicate missing columns, relations, or other schema drift:

1. Confirm the failing deployment contains the intended migration files.
2. Run `npx prisma migrate deploy` against production.
3. Re-run the smoke script above.

If errors indicate connection or pool pressure instead:

1. Review `PRISMA_CONNECTION_LIMIT` and `PRISMA_POOL_TIMEOUT`.
2. Reduce expensive listing-page fan-out where possible.
3. Re-run the smoke script after the config or code change is live.
