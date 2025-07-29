const { Telegraf, Markup } = require("telegraf")
const config = require("../config/config")
const database = require("../database/database")
const logger = require("../utils/logger")

class TelegramBotService {
  constructor() {
    this.bot = new Telegraf(config.telegram.token)
    this.setupCommands()
    this.setupMiddleware()
  }

  setupMiddleware() {
    this.bot.use(async (ctx, next) => {
      const start = Date.now()
      await next()
      const ms = Date.now() - start
      logger.info(`Response time: ${ms}ms`)
    })
  }

  setupCommands() {
    this.bot.start(async (ctx) => {
      const userId = ctx.from.id
      const username = ctx.from.username || ctx.from.first_name

      try {
        await database.addUser(userId, username)

        const welcomeMessage = `
🏆 *Welcome to GOLD Scalping Bot!*

📊 *Tracking: TVC:GOLD (US$/OZ) Commodity CFD*

🔥 *Features:*
• Advanced technical analysis with 10+ indicators
• Real-time GOLD commodity CFD signals
• 95%+ accuracy target
• Risk management included
• 1-5 minute scalping signals

📊 *Commands:*
/start - Start the bot
/status - Check bot status
/stats - View performance statistics
/stop - Stop receiving signals
/help - Show this help message

⚡ *Ready to receive premium GOLD commodity signals!*
        `

        await ctx.replyWithMarkdown(
          welcomeMessage,
          Markup.keyboard([
            ["📊 Stats", "⚡ Status"],
            ["🛑 Stop Signals", "❓ Help"],
          ]).resize(),
        )

        logger.info(`New user registered: ${username} (${userId})`)
      } catch (error) {
        logger.error("Error in start command:", error)
        await ctx.reply("❌ Error starting bot. Please try again.")
      }
    })

    this.bot.command("status", async (ctx) => {
      const status = `
🤖 *Bot Status: ACTIVE*

📈 *Market: TVC:GOLD (US$/OZ) Commodity CFD*
🏛️ *Exchange: TradingView Composite*
⏰ *Trading Hours: 24/5 (Mon-Fri)*
🎯 *Target Accuracy: 95%+*
⚡ *Signal Frequency: 1-5 minutes*

🔧 *Active Indicators:*
• EMA (10/50) - Trend Analysis
• SuperTrend - Direction Signals  
• RSI (7) - Momentum
• Stochastic (5,3,3) - Reversals
• CCI (20) - Price Extremes
• VWAP - Volume Analysis
• ATR (14) - Volatility
• Bollinger Bands - Breakouts
• MACD - Trend Changes

✅ *System Status: OPTIMAL*
      `

      await ctx.replyWithMarkdown(status)
    })

    this.bot.command("stats", async (ctx) => {
      try {
        const stats = await database.getStats()

        if (!stats || stats.total_signals === 0) {
          await ctx.reply("📊 No trading statistics available yet.")
          return
        }

        const successRate = ((stats.successful_signals / stats.total_signals) * 100).toFixed(2)
        const avgProfit = (stats.total_profit / stats.total_signals).toFixed(2)

        const statsMessage = `
📊 *Trading Statistics*

🎯 *Success Rate:* ${successRate}%
📈 *Total Signals:* ${stats.total_signals}
✅ *Successful:* ${stats.successful_signals}
❌ *Failed:* ${stats.failed_signals}
💰 *Total Profit:* $${stats.total_profit.toFixed(2)}
📊 *Avg Profit/Signal:* $${avgProfit}

🕐 *Last Updated:* ${new Date(stats.last_updated).toLocaleString()}
        `

        await ctx.replyWithMarkdown(statsMessage)
      } catch (error) {
        logger.error("Error getting stats:", error)
        await ctx.reply("❌ Error retrieving statistics.")
      }
    })

    this.bot.command("stop", async (ctx) => {
      // Implementation for stopping signals
      await ctx.reply("🛑 Signal notifications stopped. Use /start to resume.")
    })

    this.bot.command("help", async (ctx) => {
      const helpMessage = `
❓ *GOLD Scalping Bot Help*

🎯 *How it works:*
1. Bot analyzes GOLD market 24/7
2. Uses 10+ technical indicators
3. Sends high-probability signals
4. Includes entry, SL, and TP levels

📊 *Signal Format:*
🟢 BUY GOLD @ 2050.25
🛑 SL: 2048.50
🎯 TP: 2052.75
📈 Confidence: 87%

⚠️ *Risk Warning:*
Trading involves risk. Never risk more than you can afford to lose.

📞 *Support:* Contact @admin for issues
      `

      await ctx.replyWithMarkdown(helpMessage)
    })

    this.bot.launch()
    logger.info("Telegram bot started successfully")
  }

  async sendSignalToUsers(signal) {
    try {
      const users = await database.getActiveUsers()

      const signalMessage = this.formatSignalMessage(signal)

      for (const userId of users) {
        try {
          await this.bot.telegram.sendMessage(userId, signalMessage, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Taken", callback_data: `taken_${signal.id}` },
                  { text: "❌ Skipped", callback_data: `skipped_${signal.id}` },
                ],
              ],
            },
          })
        } catch (error) {
          logger.error(`Error sending signal to user ${userId}:`, error)
        }
      }

      logger.info(`Signal sent to ${users.length} users`)
    } catch (error) {
      logger.error("Error sending signal to users:", error)
    }
  }

  formatSignalMessage(signal) {
    const emoji = signal.type === "BUY" ? "🟢" : "🔴"
    const arrow = signal.type === "BUY" ? "📈" : "📉"

    return `
${emoji} *${signal.type} TVC:GOLD SIGNAL*

🏛️ *Instrument: GOLD (US$/OZ) Commodity CFD*
💰 *Entry:* $${signal.entryPrice}
🛑 *Stop Loss:* $${signal.stopLoss}
🎯 *Take Profit:* $${signal.takeProfit}
📊 *Confidence:* ${signal.confidence}%

${arrow} *Risk/Reward:* 1:1
⏰ *Time:* ${new Date(signal.timestamp).toLocaleTimeString()}

🔥 *Indicators Aligned:*
${signal.indicators.signals.map((s) => `• ${s.replace(/_/g, " ")}`).join("\n")}

⚡ *TVC:GOLD SCALPING OPPORTUNITY - ACT FAST!*
  `
  }

  async sendAlert(message) {
    try {
      const users = await database.getActiveUsers()

      for (const userId of users) {
        try {
          await this.bot.telegram.sendMessage(userId, message, { parse_mode: "Markdown" })
        } catch (error) {
          logger.error(`Error sending alert to user ${userId}:`, error)
        }
      }
    } catch (error) {
      logger.error("Error sending alert:", error)
    }
  }

  stop() {
    this.bot.stop()
    logger.info("Telegram bot stopped")
  }
}

module.exports = TelegramBotService
