#!/bin/bash

echo "🔄 Restarting Crypto Trading Bot..."

# Stop first
./stop-bot.sh

echo ""
echo "⏳ Waiting 5 seconds..."
sleep 5

# Start again
echo "🚀 Starting bot..."
if [ -f "start-bot.sh" ]; then
    ./start-bot.sh
elif command -v pm2 &> /dev/null; then
    pm2 start bot.js --name crypto-bot
elif [ -f "docker-compose.yml" ]; then
    docker-compose up -d
else
    node bot.js
fi

echo "✅ Restart completed!"
r