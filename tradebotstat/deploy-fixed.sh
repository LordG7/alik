#!/bin/bash

echo "🚀 Deploying Crypto Trading Bot to Digital Ocean..."

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
# if [[ $EUID -eq 0 ]]; then
#    print_error "This script should not be run as root"
#    exit 1
# fi

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker if not already installed properly
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    print_warning "Docker already installed, checking if it's running..."
fi

# Start Docker daemon
print_status "Starting Docker daemon..."
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    print_status "Docker Compose already installed"
fi

# Install Node.js and npm for local development
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    print_status "Node.js already installed"
fi

# Create project directory
PROJECT_DIR="crypto-telegram-bot"
if [ -d "$PROJECT_DIR" ]; then
    print_warning "Project directory already exists, backing up..."
    mv "$PROJECT_DIR" "${PROJECT_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
fi

print_status "Creating project directory..."
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Create package.json
print_status "Creating package.json..."
cat > package.json << 'EOF'
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
print_status "Creating .env.example..."
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

# Create Dockerfile
print_status "Creating Dockerfile..."
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port (optional, for health checks)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
EOF

# Create docker-compose.yml
print_status "Creating docker-compose.yml..."
cat > docker-compose.yml << 'EOF'
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

# Create .dockerignore
cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.coverage
.coverage/
logs/
*.log
EOF

# Install PM2 for process management
print_status "Installing PM2..."
sudo npm install -g pm2

# Setup environment file
print_status "Setting up environment file..."
if [ ! -f .env ]; then
    cp .env.example .env
    print_warning "Please edit .env file with your credentials:"
    print_warning "nano .env"
    
    # Interactive setup
    echo ""
    echo "🔧 Let's configure your bot:"
    echo ""
    
    read -p "Enter your Telegram Bot Token: " BOT_TOKEN
    read -p "Enter your Telegram Chat ID: " CHAT_ID
    read -p "Enter your Binance API Key (optional): " BINANCE_KEY
    read -p "Enter your Binance Secret Key (optional): " BINANCE_SECRET
    
    # Update .env file
    sed -i "s/your_telegram_bot_token_here/$BOT_TOKEN/" .env
    sed -i "s/your_telegram_chat_id/$CHAT_ID/" .env
    
    if [ ! -z "$BINANCE_KEY" ]; then
        sed -i "s/your_binance_api_key/$BINANCE_KEY/" .env
    fi
    
    if [ ! -z "$BINANCE_SECRET" ]; then
        sed -i "s/your_binance_secret_key/$BINANCE_SECRET/" .env
    fi
    
    print_status "Environment configured!"
else
    print_warning ".env file already exists"
fi

# Create startup script
print_status "Creating startup script..."
cat > start-bot.sh << 'EOF'
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

chmod +x start-bot.sh

# Create stop script
cat > stop-bot.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping Crypto Trading Bot..."
pm2 stop crypto-bot
pm2 delete crypto-bot
echo "✅ Bot stopped successfully!"
EOF

chmod +x stop-bot.sh

# Create logs directory
mkdir -p logs data

print_status "Project structure created successfully!"

echo ""
echo "📋 Next Steps:"
echo "1. Edit your .env file: nano .env"
echo "2. Add your bot files (bot.js, indicators.js, etc.)"
echo "3. Install dependencies: npm install"
echo "4. Start the bot: ./start-bot.sh"
echo ""
echo "🐳 Docker Commands:"
echo "• Build and start: docker-compose up -d"
echo "• View logs: docker-compose logs -f"
echo "• Stop: docker-compose down"
echo ""
echo "🔧 PM2 Commands:"
echo "• Start: ./start-bot.sh"
echo "• Stop: ./stop-bot.sh"
echo "• Status: pm2 status"
echo "• Logs: pm2 logs crypto-bot"
echo ""

print_status "Deployment setup completed!"
