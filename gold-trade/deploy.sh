#!/bin/bash

# GOLD Scalping Bot Deployment Script for Digital Ocean Ubuntu 24.10

echo "🚀 Deploying GOLD Scalping Bot..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt-get update
sudo apt-get install -y docker-ce docker-compose

# Create application directory
sudo mkdir -p /opt/gold-scalping-bot
cd /opt/gold-scalping-bot

# Copy application files (assuming they're in current directory)
sudo cp -r . /opt/gold-scalping-bot/

# Create data and logs directories
sudo mkdir -p data logs

# Set permissions
sudo chown -R $USER:$USER /opt/gold-scalping-bot

# Create environment file
cat > .env << EOF
BOT_TOKEN=your_telegram_bot_token_here
ADMIN_USER_ID=your_telegram_user_id
API_KEY=your_forex_api_key
DATABASE_PATH=/app/data/trading_bot.db
LOG_LEVEL=info
ENVIRONMENT=production
EOF

echo "⚠️  Please edit .env file with your actual credentials"

# Install dependencies
npm install

# Create systemd service
sudo tee /etc/systemd/system/gold-scalping-bot.service > /dev/null <<EOF
[Unit]
Description=GOLD Scalping Telegram Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/gold-scalping-bot
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable gold-scalping-bot

echo "✅ Deployment completed!"
echo ""
echo "📝 Next steps:"
echo "1. Edit /opt/gold-scalping-bot/.env with your credentials"
echo "2. Start the bot: sudo systemctl start gold-scalping-bot"
echo "3. Check status: sudo systemctl status gold-scalping-bot"
echo "4. View logs: sudo journalctl -u gold-scalping-bot -f"
echo ""
echo "🔧 Management commands:"
echo "• Start: sudo systemctl start gold-scalping-bot"
echo "• Stop: sudo systemctl stop gold-scalping-bot"
echo "• Restart: sudo systemctl restart gold-scalping-bot"
echo "• Status: sudo systemctl status gold-scalping-bot"
