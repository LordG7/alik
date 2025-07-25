# Cryptocurrency Trading Bot for Telegram

A sophisticated cryptocurrency trading bot that uses multiple technical indicators to generate trading signals and sends them via Telegram.

## Features

- **5 Technical Indicators**: SuperTrend, EMA RSI, Stochastic, CCI, VWAP + Bollinger Bands
- **1:1 Risk-Reward Ratio**: Automatic TP/SL calculation
- **Single Position Management**: Only one trade open at a time
- **Telegram Integration**: Real-time signals and position updates
- **Risk Management**: Built-in position sizing and daily loss limits
- **Docker Support**: Easy deployment on Digital Ocean

## Setup Instructions

### 1. Create Telegram Bot
1. Message @BotFather on Telegram
2. Create new bot with `/newbot`
3. Save the bot token

### 2. Get Chat ID
1. Add your bot to a group or message it directly
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find your chat ID in the response

### 3. Binance API (Optional for live trading)
1. Create Binance account
2. Generate API keys in account settings
3. Enable spot trading permissions

### 4. Environment Setup
\`\`\`bash
cp .env.example .env
# Edit .env with your credentials
\`\`\`

### 5. Local Development
\`\`\`bash
npm install
npm run dev
\`\`\`

### 6. Digital Ocean Deployment
\`\`\`bash
# Build and run with Docker
docker-compose up -d
\`\`\`

## Configuration

Edit `.env` file:
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `CHAT_ID`: Your Telegram chat ID
- `SYMBOLS`: Trading pairs separated by commas (e.g., INJUSDT,BTCUSDT,ETHUSDT,BNBUSDT,ADAUSDT)
- `TIMEFRAME`: Analysis timeframe (5m, 15m, 1h)
- `TRADE_AMOUNT_PER_PAIR`: Position size per pair in USDT
- `MAX_CONCURRENT_POSITIONS`: Maximum number of simultaneous positions (1-5)

## Supported Pairs

The bot is configured to trade these popular cryptocurrency pairs:
- **INJUSDT** - Injective Protocol
- **BTCUSDT** - Bitcoin
- **ETHUSDT** - Ethereum  
- **BNBUSDT** - Binance Coin
- **ADAUSDT** - Cardano

## Multi-Pair Features

- **Concurrent Trading**: Trade up to 3 pairs simultaneously
- **Individual Risk Management**: Each pair has its own position sizing
- **Pair Performance Tracking**: Monitor win rates and PnL per pair
- **Smart Position Management**: Prevents overexposure to any single pair

## Bot Commands

- `/start` - Initialize bot
- `/status` - Check bot status and active pairs
- `/positions` - View all active positions
- `/pairs` - View pair performance statistics
- `/stop` - Stop trading on all pairs
- `/start_trading` - Resume trading on all pairs

## Technical Indicators

1. **SuperTrend**: Trend following indicator
2. **EMA RSI**: Smoothed RSI for momentum
3. **Stochastic**: Overbought/oversold conditions
4. **CCI**: Commodity Channel Index
5. **VWAP + BB**: Volume-weighted price with Bollinger Bands

## Risk Management

- Maximum 2% risk per trade
- 5% daily loss limit
- 1:1 Risk-Reward ratio
- Position size based on account balance

## Disclaimer

This bot is for educational purposes. Cryptocurrency trading involves significant risk. Always test with small amounts first.
