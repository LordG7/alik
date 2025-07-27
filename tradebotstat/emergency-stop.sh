#!/bin/bash

echo "🚨 EMERGENCY STOP - Crypto Trading Bot"
echo "======================================"

# Kill all processes immediately
echo "💥 Force killing all bot processes..."

# Kill by process name
pkill -9 -f "bot.js"
pkill -9 -f "crypto"
pkill -9 -f "trading"

# Stop PM2
if command -v pm2 &> /dev/null; then
    pm2 kill
fi

# Stop Docker
if command -v docker &> /dev/null; then
    docker stop $(docker ps -q) 2>/dev/null
fi

# Stop system service
sudo systemctl stop crypto-bot 2>/dev/null

echo "🛑 Emergency stop completed!"
echo "🔍 Checking for remaining processes..."

if pgrep -f "bot" > /dev/null; then
    echo "⚠️  Some processes may still be running:"
    ps aux | grep -E "(bot|crypto)" | grep -v grep
else
    echo "✅ All processes stopped"
fi
