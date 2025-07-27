#!/bin/bash

# Deployment script for Digital Ocean Ubuntu 24.10

echo "🚀 Deploying Binance Trading Bot to Digital Ocean..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install build essentials for native modules
sudo apt-get install -y build-essential python3-dev

# Create app directory
sudo mkdir -p /opt/trading-bot
sudo chown $USER:$USER /opt/trading-bot
cd /opt/trading-bot

# Copy files (assuming you're running this from your project directory)
cp -r * /opt/trading-bot/

# Install dependencies
npm install

# Create .env file
echo "Creating environment file..."
cat > .env << EOL
BOT_TOKEN=your_telegram_bot_token_here
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_SECRET_KEY=your_binance_secret_key_here
ADMIN_USER_ID=your_admin_telegram_id_here
NODE_ENV=production
EOL

echo "⚠️  Please edit /opt/trading-bot/.env with your actual API keys"

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: 'binance-trading-bot',
    script: 'bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOL

# Set up firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Start the bot with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "✅ Deployment completed!"
echo ""
echo "Next steps:"
echo "1. Edit /opt/trading-bot/.env with your API keys"
echo "2. Restart the bot: pm2 restart binance-trading-bot"
echo "3. Check logs: pm2 logs binance-trading-bot"
echo "4. Monitor: pm2 monit"
