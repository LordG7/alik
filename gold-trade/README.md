# 🏆 GOLD Scalping Telegram Bot

Advanced GOLD (XAU/USD) scalping bot with 95%+ accuracy target, featuring 10+ technical indicators and real-time Telegram signals.

## 🔥 Features

- **Multi-Indicator Analysis**: EMA, SuperTrend, RSI, Stochastic, CCI, VWAP, ATR, Bollinger Bands, MACD, Fractals
- **High Accuracy**: 95%+ success rate target with advanced signal filtering
- **Risk Management**: Dynamic SL/TP based on ATR, position sizing, daily limits
- **Real-time Signals**: Instant Telegram notifications with entry, SL, and TP levels
- **Self-Optimization**: Continuous performance monitoring and strategy adjustment
- **Market Hours Analysis**: Optimal trading time detection
- **Comprehensive Logging**: Full audit trail and performance tracking

## 📊 Technical Indicators

1. **EMA (10/50)** - Trend detection and crossover signals
2. **VWAP** - Volume-weighted average price for intraday balance
3. **SuperTrend** - Clear trend direction with minimal lag
4. **RSI (7)** - Overbought/oversold conditions for scalping
5. **Stochastic (5,3,3)** - Short-term reversal signals
6. **CCI (20)** - Price normality analysis
7. **ATR (14)** - Dynamic volatility-based SL/TP
8. **Fractals + EMA** - Local support/resistance with trend
9. **Bollinger Bands (20, 2.0)** - Breakout signals
10. **MACD (12,26,9)** - Micro trend changes

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Telegram Bot Token
- Digital Ocean Ubuntu 24.10 server

### Installation

1. **Clone and setup:**
\`\`\`bash
git clone <repository>
cd gold-scalping-bot
npm install
\`\`\`

2. **Configure environment:**
\`\`\`bash
cp .env.example .env
# Edit .env with your credentials
\`\`\`

3. **Deploy to Digital Ocean:**
\`\`\`bash
chmod +x deploy.sh
./deploy.sh
\`\`\`

4. **Start the bot:**
\`\`\`bash
sudo systemctl start gold-scalping-bot
\`\`\`

## 📱 Telegram Commands

- `/start` - Start receiving signals
- `/status` - Check bot status
- `/stats` - View performance statistics
- `/stop` - Stop signal notifications
- `/help` - Show help information

## 🎯 Signal Format

\`\`\`
🟢 BUY GOLD SIGNAL

💰 Entry: $2050.25
🛑 Stop Loss: $2048.50
🎯 Take Profit: $2052.75
📊 Confidence: 87%

📈 Risk/Reward: 1:1
⏰ Time: 14:30:25

🔥 Indicators Aligned:
• EMA BULLISH
• RSI OVERSOLD
• SUPERTREND BULLISH
• VWAP BELOW

⚡ SCALPING OPPORTUNITY - ACT FAST!
\`\`\`

## ⚙️ Configuration

### Trading Parameters
- **Symbol**: XAUUSD (GOLD)
- **Timeframes**: 1m, 5m
- **Risk per Trade**: 2%
- **Max Daily Trades**: 20
- **Trading Hours**: 09:00 - 20:00 EST

### Risk Management
- **Minimum Confidence**: 70%
- **Risk/Reward Ratio**: 1:1 minimum
- **Position Sizing**: ATR-based
- **Daily Limits**: Automatic reset

## 📈 Performance Monitoring

The bot continuously monitors:
- Success rate (target: 95%+)
- Profit/Loss tracking
- Signal quality metrics
- Market condition analysis
- System health checks

## 🛡️ Risk Management Features

- **Dynamic Stop Loss**: ATR-based volatility adjustment
- **Position Sizing**: Account balance percentage
- **Daily Trade Limits**: Prevent overtrading
- **Market Hours Filter**: Optimal trading times only
- **Signal Validation**: Multi-layer filtering
- **Performance Tracking**: Continuous optimization

## 🔧 System Requirements

- **RAM**: 1GB minimum
- **Storage**: 10GB minimum
- **Network**: Stable internet connection
- **OS**: Ubuntu 24.10 (recommended)

## 📊 Database Schema

- **Users**: Telegram user management
- **Signals**: Trading signal history
- **Performance**: Trade results tracking
- **Bot Stats**: Overall performance metrics

## 🚨 Alerts & Notifications

- Signal notifications
- System health alerts
- Daily performance reports
- Error notifications
- Market condition updates

## 📝 Logging

Comprehensive logging system:
- Trade signals and results
- System performance metrics
- Error tracking and debugging
- User activity monitoring

## 🔒 Security Features

- User authentication
- Admin-only commands
- Secure API key handling
- Database encryption
- Rate limiting

## 🆘 Support

For issues or questions:
1. Check logs: `sudo journalctl -u gold-scalping-bot -f`
2. Review configuration
3. Contact system administrator

## ⚠️ Disclaimer

Trading involves substantial risk. This bot is for educational purposes. Never risk more than you can afford to lose. Past performance does not guarantee future results.

## 📄 License

MIT License - See LICENSE file for details.
