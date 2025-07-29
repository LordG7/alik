const cron = require("node-cron")
const config = require("./config/config")
const logger = require("./utils/logger")
const marketData = require("./services/marketData")
const technicalAnalysis = require("./services/technicalAnalysis")
const riskManagement = require("./services/riskManagement")
const database = require("./database/database")
const TelegramBotService = require("./services/telegramBot")

class GoldScalpingBot {
  constructor() {
    this.telegramBot = new TelegramBotService()
    this.isRunning = false
    this.lastSignalTime = 0
    this.signalCooldown = 60000 // 1 minute cooldown between signals
  }

  async start() {
    logger.info("🚀 Starting GOLD Scalping Bot...")

    this.isRunning = true

    // Send startup notification
    await this.telegramBot.sendAlert(
      "🚀 *GOLD Scalping Bot Started!*\n\n✅ System Online\n📊 Monitoring GOLD market...",
    )

    // Schedule market analysis every 30 seconds
    cron.schedule("*/30 * * * * *", async () => {
      if (this.isRunning) {
        await this.analyzeMarket()
      }
    })

    // Schedule daily statistics report
    cron.schedule("0 0 * * *", async () => {
      await this.sendDailyReport()
    })

    // Schedule system health check every hour
    cron.schedule("0 * * * *", async () => {
      await this.healthCheck()
    })

    logger.info("✅ GOLD Scalping Bot started successfully")
  }

  async analyzeMarket() {
    try {
      // Check if we can trade
      if (!(await riskManagement.canTrade())) {
        return
      }

      // Check signal cooldown
      if (Date.now() - this.lastSignalTime < this.signalCooldown) {
        return
      }

      // Get market data
      const ohlcData = await marketData.getOHLCData(config.trading.symbol, "5m", 100)
      if (!ohlcData || ohlcData.length < 50) {
        logger.warn("Insufficient market data")
        return
      }

      // Calculate technical indicators
      const indicators = technicalAnalysis.calculateIndicators(ohlcData)
      if (!indicators) {
        logger.warn("Failed to calculate indicators")
        return
      }

      // Generate trading signal
      const signal = technicalAnalysis.generateSignal(indicators)
      if (!signal) {
        return // No signal generated
      }

      // Validate signal with risk management
      if (!riskManagement.validateSignal(signal)) {
        return
      }

      // Save signal to database
      const signalId = await database.addSignal(signal)
      signal.id = signalId

      // Send signal to users
      await this.telegramBot.sendSignalToUsers(signal)

      // Update counters
      riskManagement.incrementTradeCount()
      this.lastSignalTime = Date.now()

      logger.info(`📊 Signal generated: ${signal.type} @ ${signal.entryPrice} (Confidence: ${signal.confidence}%)`)
    } catch (error) {
      logger.error("Error in market analysis:", error)
    }
  }

  async sendDailyReport() {
    try {
      const stats = await database.getStats()

      if (!stats || stats.total_signals === 0) {
        return
      }

      const successRate = ((stats.successful_signals / stats.total_signals) * 100).toFixed(2)

      const reportMessage = `
📊 *Daily Trading Report*

🎯 *Success Rate:* ${successRate}%
📈 *Total Signals:* ${stats.total_signals}
✅ *Successful:* ${stats.successful_signals}
💰 *Total Profit:* $${stats.total_profit.toFixed(2)}

${
  successRate >= 90
    ? "🔥 *EXCELLENT PERFORMANCE!*"
    : successRate >= 80
      ? "✅ *GOOD PERFORMANCE*"
      : "⚠️ *PERFORMANCE REVIEW NEEDED*"
}
      `

      await this.telegramBot.sendAlert(reportMessage)
    } catch (error) {
      logger.error("Error sending daily report:", error)
    }
  }

  async healthCheck() {
    try {
      // Check market data connectivity
      const currentPrice = await marketData.getCurrentPrice(config.trading.symbol)

      if (!currentPrice) {
        await this.telegramBot.sendAlert("⚠️ *System Alert*\n\nMarket data connection issue detected.")
        return
      }

      // Check database connectivity
      const stats = await database.getStats()

      if (!stats) {
        await this.telegramBot.sendAlert("⚠️ *System Alert*\n\nDatabase connection issue detected.")
        return
      }

      logger.info("✅ Health check passed")
    } catch (error) {
      logger.error("Health check failed:", error)
      await this.telegramBot.sendAlert("🚨 *System Alert*\n\nHealth check failed. Please check logs.")
    }
  }

  async stop() {
    logger.info("🛑 Stopping GOLD Scalping Bot...")

    this.isRunning = false
    this.telegramBot.stop()

    await this.telegramBot.sendAlert("🛑 *GOLD Scalping Bot Stopped*\n\n❌ System Offline")

    logger.info("✅ GOLD Scalping Bot stopped successfully")
  }
}

// Initialize and start the bot
const bot = new GoldScalpingBot()

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully...")
  await bot.stop()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully...")
  await bot.stop()
  process.exit(0)
})

// Start the bot
bot.start().catch((error) => {
  logger.error("Failed to start bot:", error)
  process.exit(1)
})
