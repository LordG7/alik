#!/bin/bash

echo "🔧 Installing dependencies for Binance Trading Bot..."

# Remove problematic talib if it exists
npm uninstall talib

# Install required dependencies
npm install telegraf@4.15.6
npm install binance-api-node@0.12.4
npm install node-cron@3.0.3
npm install axios@1.6.2
npm install dotenv@16.3.1
npm install sqlite3@5.1.6

# Install build tools for native modules
sudo apt-get update
sudo apt-get install -y build-essential python3-dev

echo "✅ Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Configure your .env file with API keys"
echo "2. Run: npm start"
