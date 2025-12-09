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

echo "🏗️  Building application..."
npm run build

echo "♻️  Restarting service..."
systemctl restart sixfigjobs-prod

echo "⏳ Waiting for service to start..."
sleep 5

echo "✅ Checking service status..."
systemctl status sixfigjobs-prod --no-pager

echo ""
echo "🎉 Deployment complete!"
echo "🌐 Check: https://6figjobs.com"
