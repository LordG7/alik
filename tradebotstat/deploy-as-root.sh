#!/bin/bash

echo "🚀 Deploying Crypto Trading Bot to Digital Ocean (Root Setup)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Create a non-root user for the bot
BOT_USER="botuser"
if ! id "$BOT_USER" &>/dev/null; then
    print_status "Creating user: $BOT_USER"
    useradd -m -s /bin/bash $BOT_USER
    usermod -aG sudo $BOT_USER
    
    # Set password for the user (optional)
    echo "Set password for $BOT_USER:"
    passwd $BOT_USER
else
    print_warning "User $BOT_USER already exists"
fi

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
apt install -y curl wget git nano htop unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Docker
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $BOT_USER
    rm get-docker.sh
else
    print_warning "Docker already installed"
    usermod -aG docker $BOT_USER
fi

# Start and enable Docker
print_status "Starting Docker daemon..."
systemctl start docker
systemctl enable docker

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    print_status "Docker Compose already installed"
fi

# Install Node.js
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    print_status "Node.js already installed"
fi

# Install PM2 globally
print_status "Installing PM2..."
npm install -g pm2

# Create project directory in user's home
PROJECT_DIR="/home/$BOT_USER/crypto-telegram-bot"
print_status "Creating project directory: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR"

# Set ownership to bot user
chown -R $BOT_USER:$BOT_USER "$PROJECT_DIR"

# Create the bot files
print_status "Creating bot files..."

# Create package.json
cat > "$PROJECT_DIR/package.json" << 'EOF'
{
  "name": "crypto-telegram-trading-bot",
  "version": "1.1.0",
  "description": "Cryptocurrency trading bot with technical analysis for Telegram",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js",
    "dev": "nodemon bot.js",
    "pm2": "pm2 start bot.js --name crypto-bot"
  },
  "dependencies": {
    "telegraf": "^4.15.6",
    "axios": "^1.6.2",
    "node-cron": "^3.0.3",
    "dotenv": "^16.3.1",
    "technicalindicators": "^3.1.0",
    "ccxt": "^4.1.64"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
EOF

# Create .env.example
cat > "$PROJECT_DIR/.env.example" << 'EOF'
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key
CHAT_ID=your_telegram_chat_id
SYMBOLS=INJUSDT,BTCUSDT,ETHUSDT,BNBUSDT,ADAUSDT
TIMEFRAME=5m
TRADE_AMOUNT_PER_PAIR=50
MAX_CONCURRENT_POSITIONS=3
EOF

# Create Dockerfile
cat > "$PROJECT_DIR/Dockerfile" << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
EOF

# Create docker-compose.yml
cat > "$PROJECT_DIR/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  crypto-bot:
    build: .
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
    networks:
      - crypto-bot-network

networks:
  crypto-bot-network:
    driver: bridge
EOF

# Create startup script
cat > "$PROJECT_DIR/start-bot.sh" << 'EOF'
#!/bin/bash

echo "🚀 Starting Crypto Trading Bot..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it from .env.example"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start with PM2
echo "🔄 Starting bot with PM2..."
pm2 start bot.js --name crypto-bot --restart-delay=5000

echo "✅ Bot started successfully!"
echo "📊 Check status: pm2 status"
echo "📋 View logs: pm2 logs crypto-bot"
echo "🔄 Restart: pm2 restart crypto-bot"
echo "🛑 Stop: pm2 stop crypto-bot"
EOF

# Create stop script
cat > "$PROJECT_DIR/stop-bot.sh" << 'EOF'
#!/bin/bash
echo "🛑 Stopping Crypto Trading Bot..."
pm2 stop crypto-bot
pm2 delete crypto-bot
echo "✅ Bot stopped successfully!"
EOF

# Create setup script for user
cat > "$PROJECT_DIR/setup-user.sh" << 'EOF'
#!/bin/bash

echo "🔧 Setting up bot for user..."

# Copy .env.example to .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Please edit .env file with your credentials:"
    echo "nano .env"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Make scripts executable
chmod +x *.sh

echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file: nano .env"
echo "2. Start bot: ./start-bot.sh"
EOF

# Create directories
mkdir -p "$PROJECT_DIR/logs" "$PROJECT_DIR/data"

# Make scripts executable
chmod +x "$PROJECT_DIR"/*.sh

# Set proper ownership
chown -R $BOT_USER:$BOT_USER "$PROJECT_DIR"

# Create systemd service
print_status "Creating systemd service..."
cat > /etc/systemd/system/crypto-bot.service << EOF
[Unit]
Description=Crypto Trading Bot
After=network.target

[Service]
Type=simple
User=$BOT_USER
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

print_status "Root setup completed!"

echo ""
echo "🎯 Next Steps:"
echo "1. Switch to bot user: su - $BOT_USER"
echo "2. Go to project directory: cd crypto-telegram-bot"
echo "3. Run user setup: ./setup-user.sh"
echo "4. Edit .env file: nano .env"
echo "5. Add your bot files (bot.js, indicators.js, etc.)"
echo "6. Start the bot: ./start-bot.sh"
echo ""
echo "🔧 Alternative - System Service:"
echo "• Enable: sudo systemctl enable crypto-bot"
echo "• Start: sudo systemctl start crypto-bot"
echo "• Status: sudo systemctl status crypto-bot"
echo ""

print_status "Deployment setup completed! Switch to user '$BOT_USER' to continue."
