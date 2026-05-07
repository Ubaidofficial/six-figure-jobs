#!/bin/bash
set -e

echo "=========================================="
echo "Deploying Six Figure Jobs - Production"
echo "=========================================="

cd /var/www/six-figure-jobs

echo "📥 Pulling latest code..."
git pull origin develop

echo "📦 Installing dependencies..."
npm install --production=false

echo "🗄️  Applying Prisma migrations..."
npx prisma migrate deploy

echo "🏗️  Building application..."
npm run build

echo "♻️  Restarting service..."
systemctl restart sixfigjobs-prod

echo "⏳ Waiting for service to start..."
sleep 5

echo "✅ Checking service status..."
systemctl status sixfigjobs-prod --no-pager

echo "🧪 Running production smoke checks..."
BASE_URL="${BASE_URL:-https://www.6figjobs.com}" ./scripts/deployment/smoke-production.sh

echo ""
echo "🎉 Deployment complete!"
echo "🌐 Check: https://www.6figjobs.com"
