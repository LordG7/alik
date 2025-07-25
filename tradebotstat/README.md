# Crypto Trading Bot for Telegram

A sophisticated cryptocurrency trading bot that provides real-time trading signals via Telegram using 5 technical indicators with 1:1 risk-reward ratio.

## Features

- 🚀 **5 Technical Indicators**: SuperTrend+EMA, RSI+Stochastic, CCI, VWAP+Fractal, ATR+Bollinger Bands
- 📊 **1:1 Risk-Reward Ratio**: Optimized risk management
- 🔄 **Real-time Signals**: Continuous market analysis
- 📱 **Telegram Integration**: Easy-to-use bot interface
- 🛡️ **Risk Management**: No new signals while position is open
- 📈 **Multiple Timeframes**: 1m, 5m, 15m, 1h analysis
- 🎯 **High Accuracy**: Minimum 4/5 indicators must agree

## Quick Start

### Prerequisites

- Node.js 18+
- Telegram Bot Token (from @BotFather)
- Binance API credentials
- Digital Ocean Droplet (or any VPS)

### Installation

1. **Clone the repository**
\`\`\`bash
git clone <repository-url>
cd crypto-telegram-bot
\`\`\`

2. **Install dependencies**
\`\`\`bash
npm install
\`\`\`

3. **Configure environment**
\`\`\`bash
cp .env.example .env
# Edit .env with your credentials
\`\`\`

4. **Start the bot**
\`\`\`bash
npm start
\`\`\`

### Docker Deployment

1. **Build and run with Docker Compose**
\`\`\`bash
docker-compose up -d
\`\`\`

2. **Check logs**
\`\`\`bash
docker-compose logs -f crypto-bot
\`\`\`

## Digital Ocean Deployment

### Method 1: Docker Deployment

1. **Create a Digital Ocean Droplet**
   - Choose Ubuntu 22.04 LTS
   - Minimum 1GB RAM, 1 vCPU
   - Add your SSH key

2. **Connect to your droplet**
\`\`\`bash
ssh root@your_droplet_ip
\`\`\`

3. **Install Docker and Docker Compose**
\`\`\`bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
\`\`\`

4. **Deploy the bot**
\`\`\`bash
# Clone repository
git clone <your-repo-url>
cd crypto-telegram-bot

# Set environment variables
cp .env.example .env
nano .env  # Edit with your credentials

# Start the bot
docker-compose up -d
\`\`\`

### Method 2: PM2 Deployment

1. **Install Node.js and PM2**
\`\`\`bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2
\`\`\`

2. **Deploy the application**
\`\`\`bash
# Clone and setup
git clone <your-repo-url>
cd crypto-telegram-bot
npm install

# Configure environment
cp .env.example .env
nano .env

# Start with PM2
pm2 start src/bot.js --name "crypto-bot"
pm2 startup
pm2 save
\`\`\`

## Bot Commands

- `/start` - Start the bot and show welcome message
- `/subscribe` - Subscribe to trading signals
- `/unsubscribe` - Unsubscribe from signals
- `/status` - Check bot status and statistics
- `/settings` - Configure bot settings
- `/help` - Show help and information

## Technical Indicators

### 1. SuperTrend + EMA
- **SuperTrend**: Trend-following indicator
- **EMA**: Exponential Moving Average for trend confirmation

### 2. RSI + Stochastic
- **RSI**: Relative Strength Index for momentum
- **Stochastic**: Oscillator for overbought/oversold conditions

### 3. CCI (Commodity Channel Index)
- Measures price deviation from statistical mean
- Identifies cyclical trends

### 4. VWAP + Fractal
- **VWAP**: Volume Weighted Average Price
- **Fractal**: Support and resistance levels

### 5. ATR + Bollinger Bands
- **ATR**: Average True Range for volatility
- **Bollinger Bands**: Price volatility and mean reversion

## Risk Management

- **1:1 Risk-Reward Ratio**: Stop Loss = Take Profit distance
- **Position Management**: Only one signal per pair at a time
- **Signal Strength**: Minimum 4/5 indicators must agree
- **Volatility Filter**: Uses ATR to adjust position sizing

## Monitoring and Maintenance

### Check Bot Status
\`\`\`bash
# Docker
docker-compose logs -f crypto-bot

# PM2
pm2 logs crypto-bot
pm2 status
\`\`\`

### Update the Bot
\`\`\`bash
# Pull latest changes
git pull origin main

# Docker
docker-compose down
docker-compose up -d --build

# PM2
pm2 restart crypto-bot
\`\`\`

## Security Best Practices

1. **API Keys**: Never commit API keys to version control
2. **Firewall**: Configure UFW to allow only necessary ports
3. **Updates**: Keep system and dependencies updated
4. **Monitoring**: Set up alerts for bot downtime
5. **Backups**: Regular backup of configuration and logs

## Troubleshooting

### Common Issues

1. **Bot not responding**
   - Check Telegram token validity
   - Verify bot is running: `pm2 status` or `docker ps`

2. **No signals generated**
   - Check Binance API credentials
   - Verify market data is being fetched
   - Check indicator calculations

3. **High memory usage**
   - Restart the bot periodically
   - Monitor with `htop` or `docker stats`

### Support

For issues and support:
- Check logs first: `pm2 logs` or `docker-compose logs`
- Verify environment variables
- Test API connections manually

## License

MIT License - see LICENSE file for details.
