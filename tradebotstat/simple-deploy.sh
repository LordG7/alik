#!/bin/bash

echo "🚀 Simple Crypto Bot Deployment"
echo "==============================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo "⚠️  Running as root - creating bot user..."
    
    # Create bot user
    BOT_USER="botuser"
    if ! id "$BOT_USER" &>/dev/null; then
        useradd -m -s /bin/bash $BOT_USER
        usermod -aG sudo $BOT_USER
        echo "✅ Created user: $BOT_USER"
    fi
    
    # Install system packages
    apt update
    apt install -y curl wget git nano nodejs npm
    
    # Install PM2
    npm install -g pm2
    
    echo "✅ System setup completed!"
    echo "🔄 Now run this script as the bot user:"
    echo "su - $BOT_USER"
    echo "curl -o deploy.sh https://your-script-url && chmod +x deploy.sh && ./deploy.sh"
    exit 0
fi

# Non-root user setup
echo "✅ Running as non-root user: $(whoami)"

# Create project directory
mkdir -p ~/crypto-telegram-bot
cd ~/crypto-telegram-bot

# Install Node.js if not available
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Create package.json
echo "📝 Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "crypto-telegram-trading-bot",
  "version": "1.0.0",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js"
  },
  "dependencies": {
    "telegraf": "^4.15.6",
    "axios": "^1.6.2",
    "node-cron": "^3.0.3",
    "dotenv": "^16.3.1",
    "technicalindicators": "^3.1.0",
    "ccxt": "^4.1.64"
  }
}
EOF

# Create .env template
cat > .env.example << 'EOF'
TELEGRAM_BOT_TOKEN=your_bot_token_here
CHAT_ID=your_chat_id_here
SYMBOLS=INJUSDT,BTCUSDT,ETHUSDT,BNBUSDT,ADAUSDT
TIMEFRAME=5m
TRADE_AMOUNT_PER_PAIR=50
MAX_CONCURRENT_POSITIONS=3
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Basic setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Copy your bot files (bot.js, indicators.js, etc.) to this directory"
echo "2. Create .env file: cp .env.example .env"
echo "3. Edit .env with your credentials: nano .env"
echo "4. Start the bot: npm start"
