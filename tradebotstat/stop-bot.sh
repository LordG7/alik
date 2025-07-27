#!/bin/bash

echo "🛑 Stopping Crypto Trading Bot..."

# Method 1: Stop PM2 process
if command -v pm2 &> /dev/null; then
    echo "📊 Checking PM2 processes..."
    if pm2 list | grep -q "crypto-bot"; then
        echo "🔄 Stopping PM2 process..."
        pm2 stop crypto-bot
        pm2 delete crypto-bot
        echo "✅ PM2 process stopped"
    else
        echo "ℹ️  No PM2 process found"
    fi
fi

# Method 2: Stop Docker containers
if command -v docker &> /dev/null; then
    echo "🐳 Checking Docker containers..."
    if docker ps | grep -q "crypto-bot"; then
        echo "🔄 Stopping Docker container..."
        docker-compose down
        echo "✅ Docker container stopped"
    else
        echo "ℹ️  No Docker container found"
    fi
fi

# Method 3: Kill Node.js processes
echo "🔍 Checking for Node.js bot processes..."
BOT_PIDS=$(pgrep -f "bot.js")
if [ ! -z "$BOT_PIDS" ]; then
    echo "🔄 Killing Node.js processes..."
    echo "$BOT_PIDS" | xargs kill
    sleep 2
    
    # Force kill if still running
    BOT_PIDS=$(pgrep -f "bot.js")
    if [ ! -z "$BOT_PIDS" ]; then
        echo "💥 Force killing processes..."
        echo "$BOT_PIDS" | xargs kill -9
    fi
    echo "✅ Node.js processes stopped"
else
    echo "ℹ️  No Node.js bot processes found"
fi

# Method 4: Stop system service
if systemctl is-active --quiet crypto-bot; then
    echo "🔄 Stopping system service..."
    sudo systemctl stop crypto-bot
    echo "✅ System service stopped"
fi

echo ""
echo "🎯 Bot Stop Summary:"
echo "==================="

# Check final status
if pgrep -f "bot.js" > /dev/null; then
    echo "❌ Bot may still be running"
    echo "🔍 Remaining processes:"
    ps aux | grep bot.js | grep -v grep
else
    echo "✅ Bot completely stopped"
fi

if command -v pm2 &> /dev/null; then
    echo "📊 PM2 Status:"
    pm2 list | grep crypto || echo "   No crypto-bot in PM2"
fi

if command -v docker &> /dev/null; then
    echo "🐳 Docker Status:"
    docker ps | grep crypto || echo "   No crypto containers running"
fi

echo ""
echo "✅ Stop script completed!"

