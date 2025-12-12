# Six Figure Jobs - Server Setup Documentation

## Server Details
- **IP**: 77.42.22.103
- **Size**: 4GB RAM + 4GB swap
- **SSH**: `ssh root@77.42.22.103`
- **OS**: Ubuntu 24.04 LTS

## Architecture
- **Production**: Systemd service on port 3000 → https://www.6figjobs.com
- **Staging**: Manual start on port 3001 → http://staging.6figjobs.com
- **Database**: PostgreSQL 16 (local)
- **Web Server**: Nginx with SSL (Let's Encrypt)

## Directory Structure
```
/var/www/
├── six-figure-jobs/          # Production
│   ├── .next/                # Built assets
│   ├── .env.local            # Production DB config
│   └── ...
└── six-figure-jobs-staging/  # Staging
    ├── .next/
    ├── .env.local            # Staging DB config
    └── ...
```

## Services

### Production Service
**File**: `/etc/systemd/system/sixfigjobs-prod.service`
```ini
[Unit]
Description=Six Figure Jobs - Production
After=network.target postgresql.service
StartLimitIntervalSec=300
StartLimitBurst=3

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/six-figure-jobs
Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://sixfiguser:31456@localhost:5432/sixfigjobs"
Environment="POSTGRES_PRISMA_URL=postgresql://sixfiguser:31456@localhost:5432/sixfigjobs"
Environment="NODE_OPTIONS=--max-old-space-size=1024"
ExecStart=/usr/bin/node /var/www/six-figure-jobs/node_modules/next/dist/bin/next start -p 3000
Restart=on-failure
RestartSec=30
MemoryMax=1.5G

[Install]
WantedBy=multi-user.target
```

### Commands
```bash
# Status
systemctl status sixfigjobs-prod
journalctl -u sixfigjobs-prod -f

# Control
systemctl start sixfigjobs-prod
systemctl stop sixfigjobs-prod
systemctl restart sixfigjobs-prod

# Enable auto-start on boot
systemctl enable sixfigjobs-prod
```

## Database Configuration

### Production Database
- **Name**: `sixfigjobs`
- **User**: `sixfiguser`
- **Password**: `31456`
- **Connection**: `postgresql://sixfiguser:31456@localhost:5432/sixfigjobs`

### Staging Database
- **Name**: `sixfigjobs_staging`
- **User**: `sixfiguser`
- **Password**: `31456`
- **Connection**: `postgresql://sixfiguser:31456@localhost:5432/sixfigjobs_staging`

### PostgreSQL Optimization (4GB Server)
Located in `/etc/postgresql/16/main/postgresql.conf`:
```
shared_buffers = 256MB
effective_cache_size = 512MB
maintenance_work_mem = 64MB
work_mem = 4MB
```

## Nginx Configuration

### Production
**File**: `/etc/nginx/sites-available/six-figure-jobs`
```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name 6figjobs.com www.6figjobs.com;
    return 301 https://$host$request_uri;
}

# HTTPS
server {
    listen 443 ssl;
    server_name 6figjobs.com www.6figjobs.com;

    ssl_certificate /etc/letsencrypt/live/6figjobs.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/6figjobs.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Staging
**File**: `/etc/nginx/sites-available/staging.6figjobs.com`
```nginx
server {
    listen 80;
    server_name staging.6figjobs.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Deployment Scripts

All scripts located in `/root/`:

### 1. Deploy Production
**File**: `/root/deploy-production.sh`
```bash
#!/bin/bash
set -e
cd /var/www/six-figure-jobs
git pull origin main
npm install --production=false
npm run build
systemctl restart sixfigjobs-prod
sleep 5
systemctl status sixfigjobs-prod --no-pager
```

### 2. Start Staging
**File**: `/root/start-staging.sh`
```bash
#!/bin/bash
set -e
# Stops production, starts staging on port 3001
systemctl stop sixfigjobs-prod
cd /var/www/six-figure-jobs-staging
nohup node node_modules/next/dist/bin/next start -p 3001 > /var/log/staging.log 2>&1 &
```

### 3. Stop Staging
**File**: `/root/stop-staging.sh`
```bash
#!/bin/bash
set -e
pkill -f "next start -p 3001"
systemctl start sixfigjobs-prod
```

## Deployment Process

### Standard Production Deploy
```bash
ssh root@77.42.22.103
/root/deploy-production.sh
```

### Manual Deploy (if needed)
```bash
ssh root@77.42.22.103
cd /var/www/six-figure-jobs
git pull origin main
npm install
npm run build
systemctl restart sixfigjobs-prod
systemctl status sixfigjobs-prod
```

### Test on Staging First
```bash
ssh root@77.42.22.103
cd /var/www/six-figure-jobs-staging
git pull origin main
npm install
npm run build
/root/start-staging.sh
# Test at http://staging.6figjobs.com
/root/stop-staging.sh
```

## Monitoring

### Check Service Health
```bash
systemctl status sixfigjobs-prod
ss -tulnp | grep 3000
curl -I http://localhost:3000
```

### Check Memory
```bash
free -h
ps aux --sort=-%mem | head -10
```

### View Logs
```bash
# Service logs
journalctl -u sixfigjobs-prod -f

# Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### Database Access
```bash
sudo -u postgres psql -d sixfigjobs
sudo -u postgres psql -d sixfigjobs_staging
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
journalctl -u sixfigjobs-prod -n 50

# Check if port is in use
ss -tulnp | grep 3000
lsof -i :3000

# Kill rogue processes
pkill -f "next start"

# Reset failed state
systemctl reset-failed sixfigjobs-prod
systemctl start sixfigjobs-prod
```

### Out of Memory
```bash
# Check memory
free -h

# Check swap
swapon --show

# Check memory-hungry processes
ps aux --sort=-%mem | head -15

# Restart PostgreSQL if needed
systemctl restart postgresql
```

### Database Connection Issues
```bash
# Check PostgreSQL status
systemctl status postgresql

# Test connection
sudo -u postgres psql -d sixfigjobs -c "SELECT version();"

# Check credentials in .env.local
cat /var/www/six-figure-jobs/.env.local
```

## Important Notes

⚠️ **Memory Constraints**
- 4GB server cannot run both production + staging simultaneously
- Production has priority
- Use staging scripts to temporarily swap them

⚠️ **PM2 Disabled**
- PM2 was causing conflicts and has been completely disabled
- Use systemd only for process management

⚠️ **Swap Space**
- 4GB swap added to `/swapfile`
- Prevents OOM kills during deploys

⚠️ **SSL Certificates**
- Let's Encrypt certificates for 6figjobs.com
- Auto-renewal configured via certbot

## Quick Reference Commands
```bash
# SSH
ssh root@77.42.22.103

# Deploy
/root/deploy-production.sh

# Service control
systemctl restart sixfigjobs-prod
systemctl status sixfigjobs-prod

# Logs
journalctl -u sixfigjobs-prod -f

# Memory
free -h

# Database
sudo -u postgres psql -d sixfigjobs
```
