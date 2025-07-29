const cron = require("node-cron")
const config = require("./config/config")
const logger = require("./utils/logger")
const marketData = require("./services/marketData")
const technicalAnalysis = require("./services/technicalAnalysis")
const riskManagement = require("./services/riskManagement")
const database = require("./database/database")
const TelegramBotService = require("./services/telegramBot")
const tradingViewData = require("./services/tradingViewData") // Import tradingViewData service

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

      // Get TVC:GOLD market data
      const ohlcData = await tradingViewData.getMarketData("5m", 50)
      if (!ohlcData || ohlcData.length < 10) {
        logger.warn("Insufficient TVC:GOLD market data")
        return
      }

      // Enhanced signal generation for GOLD commodity
      const currentPrice = ohlcData[0].close
      const previousPrice = ohlcData[1].close
      const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100

      // Calculate volatility for GOLD commodity
      const prices = ohlcData.slice(0, 10).map((d) => d.close)
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
      const volatility = Math.sqrt(
        prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length,
      )

      // Generate signal based on GOLD commodity characteristics
      // GOLD typically moves in larger increments, so we use 0.05% threshold
      if (Math.abs(priceChange) > 0.05 && volatility > 1.0) {
        const signal = this.createGoldCommoditySignal(currentPrice, priceChange > 0 ? "BUY" : "SELL", volatility)

        if (signal) {
          const signalId = await database.addSignal(signal)
          signal.id = signalId

          await this.telegramBot.sendSignalToUsers(signal)
          this.lastSignalTime = Date.now()

          logger.info(
            `📊 TVC:GOLD Signal generated: ${signal.type} @ $${signal.entryPrice} (Confidence: ${signal.confidence}%)`,
          )
        }
      }
    } catch (error) {
      logger.error("Error in TVC:GOLD market analysis:", error)
    }
  }

  createGoldCommoditySignal(currentPrice, type, volatility) {
    // GOLD commodity specific ATR calculation (typically $2-5 range)
    const atr = Math.max(2.0, volatility * 1.5) // Minimum $2 ATR for GOLD

    const stopLoss = type === "BUY" ? currentPrice - atr : currentPrice + atr
    const takeProfit = type === "BUY" ? currentPrice + atr : currentPrice - atr

    // Higher confidence for GOLD commodity signals with good volatility
    const baseConfidence = 80
    const volatilityBonus = Math.min(15, volatility * 2) // Up to 15% bonus for high volatility
    const confidence = Math.min(95, baseConfidence + volatilityBonus)

    return {
      type,
      entryPrice: Number.parseFloat(currentPrice.toFixed(2)),
      stopLoss: Number.parseFloat(stopLoss.toFixed(2)),
      takeProfit: Number.parseFloat(takeProfit.toFixed(2)),
      confidence: Number.parseFloat(confidence.toFixed(1)),
      indicators: {
        signals: ["TVC_GOLD_MOVEMENT", "VOLATILITY_BREAKOUT"],
        volatility: Number.parseFloat(volatility.toFixed(2)),
        atr: Number.parseFloat(atr.toFixed(2)),
      },
      timestamp: new Date().toISOString(),
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
