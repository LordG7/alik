# Binance Trading Bot

A professional Telegram bot for Binance futures trading signals with advanced technical analysis.

## Features

- 🚀 Real-time trading signals (Long/Short)
- 📊 Multiple technical indicators analysis
- 🎯 Stop loss and take profit levels
- ⏱️ 5-15 minute timeframe signals
- 📈 Position tracking and PnL monitoring
- 🤖 Optional auto-trading capabilities
- 💾 SQLite database for data persistence

## Technical Indicators

- **SuperTrend**: Trend following indicator
- **EMA + RSI**: Moving averages with momentum
- **Stochastic**: Momentum oscillator
- **CCI**: Commodity Channel Index
- **VWAP + Bollinger Bands**: Volume and volatility analysis

## Installation

### Prerequisites

- Node.js 18+
- Telegram Bot Token
- Binance API Keys
- Digital Ocean Droplet (Ubuntu 24.10)

### Local Development

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Create `.env` file:
   \`\`\`env
   BOT_TOKEN=your_telegram_bot_token
   BINANCE_API_KEY=your_binance_api_key
   BINANCE_SECRET_KEY=your_binance_secret_key
   ADMIN_USER_ID=your_telegram_user_id
   \`\`\`

4. Start the bot:
   \`\`\`bash
   npm start
   \`\`\`

### Production Deployment

1. Upload files to your Digital Ocean server
2. Run the deployment script:
   \`\`\`bash
   chmod +x deploy.sh
   ./deploy.sh
   \`\`\`

3. Edit the environment file:
   \`\`\`bash
   nano /opt/trading-bot/.env
   \`\`\`

4. Restart the bot:
   \`\`\`bash
   pm2 restart binance-trading-bot
   \`\`\`

## Bot Commands

- `/start` - Initialize the bot
- `/coin` - Select trading coin
- `/status` - Check bot status
- `/positions` - View open positions
- `/pnl` - Daily profit/loss report
- `/stop` - Stop receiving signals
- `/help` - Show help menu

## Signal Format

\`\`\`
🟢 LONG SIGNAL

📊 BTCUSDT
💰 Price: $43,250.00
⏰ Time: 5m

📈 Entry Levels:
• $43,200.00
• $43,150.00

🎯 Take Profit:
TP1: $43,400.00
TP2: $43,600.00
TP3: $43,800.00

🛑 Stop Loss: $42,900.00

📊 Indicators:
• SuperTrend: BUY
• RSI: 45.2
• Stochastic: 35.8/28.4
• CCI: -45.6

⚡ Confidence: 80%
\`\`\`

## Risk Management

- Maximum 2% risk per trade
- Multiple take profit levels
- ATR-based stop losses
- Position size calculation
- Daily PnL tracking

## Auto Trading (Optional)

The bot includes optional auto-trading capabilities:

- Automatic position opening
- Stop loss placement
- Take profit orders
- Risk management
- Position monitoring

**⚠️ Warning**: Auto-trading requires careful setup and carries significant risk. Only use with proper risk management and testing.

## Database Schema

The bot uses SQLite with the following tables:
- `users` - User information and settings
- `signals` - Trading signals history
- `positions` - Position tracking
- `trades` - Trade history for PnL calculation

## Monitoring

Use PM2 for process management:

\`\`\`bash
# Check status
pm2 status

# View logs
pm2 logs binance-trading-bot

# Monitor resources
pm2 monit

# Restart bot
pm2 restart binance-trading-bot
\`\`\`

## Security

- Store API keys securely in environment variables
- Use IP restrictions on Binance API keys
- Enable 2FA on all accounts
- Regular security audits
- Monitor for unusual activity

## Support

For issues and support:
1. Check the logs: `pm2 logs binance-trading-bot`
2. Verify API keys and permissions
3. Check network connectivity
4. Review Binance API status

## Disclaimer

This bot is for educational purposes. Trading cryptocurrencies carries significant risk. Always:
- Test thoroughly before live trading
- Use proper risk management
- Never invest more than you can afford to lose
- Understand the risks involved

## License

MIT License - Use at your own risk.
