const { Telegraf, Markup } = require("telegraf")
const cron = require("node-cron")
const logger = require("./utils/logger")
const TradingEngine = require("./trading/engine")
const config = require("./config/config")

class CryptoTradingBot {
  constructor() {
    this.bot = new Telegraf(config.TELEGRAM_BOT_TOKEN)
    this.tradingEngine = new TradingEngine()
    this.activeUsers = new Set()
    this.setupCommands()
    this.setupCronJobs()
  }

  setupCommands() {
    // Start command
    this.bot.start((ctx) => {
      const welcomeMessage = `
🚀 *Crypto Trading Bot* 🚀

Welcome to the advanced cryptocurrency trading bot!

*Features:*
• 5 Technical Indicators Analysis
• 1:1 Risk-Reward Ratio
• Real-time Signal Alerts
• Multiple Timeframes
• Risk Management

*Commands:*
/start - Start the bot
/subscribe - Subscribe to signals
/unsubscribe - Unsubscribe from signals
/status - Check bot status
/settings - Configure settings
/help - Show help

Click /subscribe to start receiving trading signals!
      `

      ctx.replyWithMarkdown(
        welcomeMessage,
        Markup.keyboard([
          ["📊 Subscribe", "⚙️ Settings"],
          ["📈 Status", "❓ Help"],
        ]).resize(),
      )
    })

    // Subscribe command
    this.bot.command("subscribe", (ctx) => {
      const userId = ctx.from.id
      this.activeUsers.add(userId)

      ctx.replyWithMarkdown(
        "✅ *Subscribed Successfully!*\n\nYou will now receive trading signals when conditions are met.",
        Markup.keyboard([
          ["📊 Unsubscribe", "📈 Status"],
          ["⚙️ Settings", "❓ Help"],
        ]).resize(),
      )

      logger.info(`User ${userId} subscribed to signals`)
    })

    // Unsubscribe command
    this.bot.command("unsubscribe", (ctx) => {
      const userId = ctx.from.id
      this.activeUsers.delete(userId)

      ctx.replyWithMarkdown("❌ *Unsubscribed*\n\nYou will no longer receive trading signals.")
      logger.info(`User ${userId} unsubscribed from signals`)
    })

    // Status command
    this.bot.command("status", async (ctx) => {
      const status = await this.tradingEngine.getStatus()
      const message = `
📊 *Bot Status*

🔄 Status: ${status.isRunning ? "✅ Active" : "❌ Inactive"}
📈 Active Signals: ${status.activeSignals}
👥 Subscribers: ${this.activeUsers.size}
⏰ Last Update: ${new Date().toLocaleString()}
💹 Market: ${status.market || "BTC/USDT"}

*Recent Performance:*
📊 Signals Today: ${status.signalsToday || 0}
✅ Successful: ${status.successfulSignals || 0}
❌ Failed: ${status.failedSignals || 0}
      `

      ctx.replyWithMarkdown(message)
    })

    // Settings command
    this.bot.command("settings", (ctx) => {
      const settingsMessage = `
⚙️ *Trading Settings*

Current Configuration:
• Timeframe: 5m
• Risk-Reward: 1:1
• Max Spread: 0.1%
• Indicators: 5 (SuperTrend, EMA, RSI, Stochastic, CCI, VWAP, Fractal, ATR, BB)

Use inline buttons to modify settings:
      `

      ctx.replyWithMarkdown(
        settingsMessage,
        Markup.inlineKeyboard([
          [Markup.button.callback("📊 Change Timeframe", "timeframe")],
          [Markup.button.callback("💰 Risk Settings", "risk")],
          [Markup.button.callback("📈 Indicators", "indicators")],
        ]),
      )
    })

    // Help command
    this.bot.help((ctx) => {
      const helpMessage = `
❓ *Help & Information*

*Technical Indicators Used:*
1. 📈 SuperTrend + EMA
2. 📊 RSI + Stochastic
3. 🎯 CCI (Commodity Channel Index)
4. 📉 VWAP + Fractal
5. 🔄 ATR + Bollinger Bands

*Signal Types:*
🟢 BUY Signal - All indicators align bullish
🔴 SELL Signal - All indicators align bearish

*Risk Management:*
• 1:1 Risk-Reward Ratio
• Stop Loss = Take Profit distance
• No new signals while position open

*Supported Pairs:*
BTC/USDT, ETH/USDT, BNB/USDT, ADA/USDT, SOL/USDT

For support: @your_support_username
      `

      ctx.replyWithMarkdown(helpMessage)
    })

    // Handle callback queries
    this.bot.on("callback_query", (ctx) => {
      const data = ctx.callbackQuery.data

      switch (data) {
        case "timeframe":
          ctx.editMessageText(
            "Select timeframe:",
            Markup.inlineKeyboard([
              [Markup.button.callback("1m", "tf_1m"), Markup.button.callback("5m", "tf_5m")],
              [Markup.button.callback("15m", "tf_15m"), Markup.button.callback("1h", "tf_1h")],
            ]),
          )
          break
        case "risk":
          ctx.editMessageText("Risk management settings are optimized for 1:1 RR ratio.")
          break
        case "indicators":
          ctx.editMessageText("All 5 indicator groups are active and optimized for crypto trading.")
          break
      }

      ctx.answerCbQuery()
    })
  }

  setupCronJobs() {
    // Check for signals every minute
    cron.schedule("*/1 * * * *", async () => {
      try {
        await this.checkAndSendSignals()
      } catch (error) {
        logger.error("Error in cron job:", error)
      }
    })

    // Daily status report
    cron.schedule("0 0 * * *", async () => {
      await this.sendDailyReport()
    })
  }

  async checkAndSendSignals() {
    if (this.activeUsers.size === 0) return

    const signals = await this.tradingEngine.analyzeMarket()

    for (const signal of signals) {
      if (signal.strength >= 4) {
        // At least 4 out of 5 indicators agree
        await this.broadcastSignal(signal)
      }
    }
  }

  async broadcastSignal(signal) {
    const signalMessage = this.formatSignalMessage(signal)

    for (const userId of this.activeUsers) {
      try {
        await this.bot.telegram.sendMessage(userId, signalMessage, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📊 Chart", url: `https://www.tradingview.com/chart/?symbol=${signal.symbol}` },
                { text: "💹 Trade", callback_data: `trade_${signal.id}` },
              ],
            ],
          },
        })
      } catch (error) {
        logger.error(`Failed to send signal to user ${userId}:`, error)
        // Remove user if bot is blocked
        if (error.code === 403) {
          this.activeUsers.delete(userId)
        }
      }
    }

    logger.info(`Signal broadcasted to ${this.activeUsers.size} users: ${signal.symbol} ${signal.direction}`)
  }

  formatSignalMessage(signal) {
    const direction = signal.direction === "BUY" ? "🟢 BUY" : "🔴 SELL"
    const emoji = signal.direction === "BUY" ? "📈" : "📉"

    return `
${emoji} *TRADING SIGNAL* ${emoji}

${direction} ${signal.symbol}

💰 *Entry*: ${signal.entry}
🎯 *Take Profit*: ${signal.takeProfit}
🛡️ *Stop Loss*: ${signal.stopLoss}
📊 *Risk/Reward*: 1:1

*Signal Strength*: ${signal.strength}/5 ⭐
*Timeframe*: ${signal.timeframe}

*Active Indicators*:
${signal.indicators.map((ind) => `• ${ind}`).join("\n")}

⚠️ *Risk Warning*: Trading involves risk. Never risk more than you can afford to lose.

*Time*: ${new Date().toLocaleString()}
    `
  }

  async sendDailyReport() {
    const report = await this.tradingEngine.getDailyReport()
    const reportMessage = `
📊 *Daily Trading Report*

📈 Signals Generated: ${report.totalSignals}
✅ Successful: ${report.successful}
❌ Failed: ${report.failed}
📊 Success Rate: ${report.successRate}%

💰 Best Performer: ${report.bestPair}
📉 Worst Performer: ${report.worstPair}

🔄 Active Subscribers: ${this.activeUsers.size}

*Tomorrow's Market Outlook*: ${report.outlook}
    `

    for (const userId of this.activeUsers) {
      try {
        await this.bot.telegram.sendMessage(userId, reportMessage, { parse_mode: "Markdown" })
      } catch (error) {
        logger.error(`Failed to send daily report to user ${userId}:`, error)
      }
    }
  }

  start() {
    this.bot.launch()
    logger.info("Crypto Trading Bot started successfully")

    // Graceful shutdown
    process.once("SIGINT", () => this.bot.stop("SIGINT"))
    process.once("SIGTERM", () => this.bot.stop("SIGTERM"))
  }
}

// Start the bot
const bot = new CryptoTradingBot()
bot.start()

module.exports = CryptoTradingBot
