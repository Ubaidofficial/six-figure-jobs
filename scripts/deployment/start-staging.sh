#!/bin/bash
set -e

echo "=========================================="
echo "Starting Staging Environment"
echo "=========================================="

if ss -tulnp | grep -q ":3001"; then
    echo "⚠️  Staging is already running on port 3001"
    exit 1
fi

echo "⏸️  Stopping production temporarily..."
systemctl stop sixfigjobs-prod

cd /var/www/six-figure-jobs-staging

echo "🚀 Starting staging on port 3001..."
nohup node node_modules/next/dist/bin/next start -p 3001 > /var/log/staging.log 2>&1 &

STAGING_PID=$!
echo "📝 Staging PID: $STAGING_PID"

sleep 5

if ss -tulnp | grep -q ":3001"; then
    echo "✅ Staging is running!"
    echo "🌐 Access at: http://staging.6figjobs.com"
    echo ""
    echo "⚠️  Remember to stop staging: kill $STAGING_PID && systemctl start sixfigjobs-prod"
else
    echo "❌ Staging failed to start. Check /var/log/staging.log"
    systemctl start sixfigjobs-prod
fi
