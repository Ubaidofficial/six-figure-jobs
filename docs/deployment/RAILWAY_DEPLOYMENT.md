# Six Figure Jobs — Railway Deployment

## Status
**Authoritative infrastructure: Railway**  
Legacy VPS / Hetzner documentation is deprecated and archived.

This document defines how **production** is deployed, operated, and rolled back on Railway.

---

## 1) Environments

### Production (Only)
- Platform: Railway
- Branch: `develop`
- Deployment: automatic on push to `develop`
- URL: https://www.6figjobs.com

There is **no staging environment**.
All deployments affect production directly.

⚠️ Because production deploys directly from `develop`, release discipline is mandatory
(see `RELEASE_QA_SPEC.md`).

---

## 2) Deployment Model

### Build & Run
- Framework: Next.js (App Router)
- Build command:
  ```bash
  npm install
  npm run build
