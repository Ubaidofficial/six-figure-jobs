# Deployment Documentation

## Quick Start

**SSH to server:**
```bash
ssh root@77.42.22.103
```

**Deploy production:**
```bash
cd /var/www/six-figure-jobs
./scripts/deployment/deploy-production.sh
```

## Files

- `SERVER_SETUP.md` - Complete server setup and configuration documentation
- `../scripts/deployment/` - Deployment scripts

## Scripts Location on Server

The deployment scripts are also copied to `/root/` for convenience:
- `/root/deploy-production.sh`
- `/root/start-staging.sh`
- `/root/stop-staging.sh`

Use either location - they do the same thing.
