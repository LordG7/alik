#!/bin/bash

# GOLD Scalping Bot Deployment Script for Digital Ocean Ubuntu 24.10

echo "🚀 Deploying GOLD Scalping Bot..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create application directory
sudo mkdir -p /opt/gold-scalping-bot
cd /opt/gold-scalping-bot

# Create all necessary directories
sudo mkdir -p config services utils database logs data

# Set permissions
sudo chown -R $USER:$USER /opt/gold-scalping-bot

echo "📁 Creating application files..."

# Create package.json
cat > package.json << 'EOF'
{
  "name": "gold-scalping-telegram-bot",
  "version": "1.0.0",
  "description": "Advanced GOLD scalping bot with Telegram integration",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "dotenv": "^16.3.1",
    "node-cron": "^3.0.3",
    "sqlite3": "^5.1.6",
    "telegraf": "^4.15.6",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Dependencies installed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Copy all your bot files to /opt/gold-scalping-bot/"
echo "2. Make sure index.js exists in the root directory"
echo "3. Edit .env file with your credentials"
echo "4. Start the bot: sudo systemctl start gold-scalping-bot"
echo ""
echo "📂 Current directory structure should be:"
echo "/opt/gold-scalping-bot/"
echo "├── index.js"
echo "├── package.json"
echo "├── .env"
echo "├── config/"
echo "├── services/"
echo "├── utils/"
echo "├── database/"
echo "└── logs/"
