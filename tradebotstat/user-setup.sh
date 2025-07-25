#!/bin/bash

echo "👤 User Setup for Crypto Trading Bot"
echo "===================================="

# This script should be run as a regular user, not root

if [[ $EUID -eq 0 ]]; then
   echo "❌ Don't run this as root! Switch to a regular user first."
   echo "Create user: sudo useradd -m -s /bin/bash botuser"
   echo "Switch user: su - botuser"
   exit 1
fi

echo "✅ Running as user: $(whoami)"

# Create project directory
PROJECT_DIR="$HOME/crypto-telegram-bot"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

echo "📁 Working in: $PROJECT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install it first:"
    echo "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "sudo apt-get install -y nodejs"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Create all necessary files
echo "📝 Creating project files..."

# Package.json
cat > package.json << 'EOF'
{
  "name": "crypto-telegram-trading-bot",
  "version": "1.0.0",
  "description": "Crypto trading bot for Telegram",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js",
    "dev": "node bot.js",
    "pm2": "pm2 start bot.js --name crypto-bot"
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

# Environment template
cat > .env.example << 'EOF'
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key
CHAT_ID=your_telegram_chat_id
SYMBOLS=INJUSDT,BTCUSDT,ETHUSDT,BNBUSDT,ADAUSDT
TIMEFRAME=5m
TRADE_AMOUNT_PER_PAIR=50
MAX_CONCURRENT_POSITIONS=3
EOF

# Start script
cat > start.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Crypto Trading Bot..."

if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Create it from template: cp .env.example .env"
    echo "✏️  Then edit it: nano .env"
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔄 Starting bot..."
node bot.js
EOF

chmod +x start.sh

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file from template"
fi

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Add your bot files to this directory:"
echo "   - bot.js (main bot file)"
echo "   - indicators.js"
echo "   - exchange.js"
echo "   - risk-manager.js"
echo "   - pairs-manager.js"
echo "   - error-handler.js"
echo ""
echo "2. Configure your bot:"
echo "   nano .env"
echo ""
echo "3. Start the bot:"
echo "   ./start.sh"
echo ""
echo "📁 Project directory: $PROJECT_DIR"
