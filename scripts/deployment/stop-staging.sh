#!/bin/bash
set -e

echo "=========================================="
echo "Stopping Staging & Restarting Production"
echo "=========================================="

echo "🛑 Killing staging processes..."
pkill -f "next start -p 3001" || echo "No staging process found"

sleep 2

echo "♻️  Starting production..."
systemctl start sixfigjobs-prod

sleep 5

systemctl status sixfigjobs-prod --no-pager

echo ""
echo "✅ Production is back online!"
echo "🌐 Check: https://www.6figjobs.com"
