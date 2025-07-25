const { Telegraf, Markup } = require("telegraf")
const cron = require("node-cron")
const TechnicalAnalysis = require("./indicators")
const ExchangeManager = require("./exchange")
const RiskManager = require("./risk-manager")
const PairsManager = require("./pairs-manager")
const ErrorHandler = require("./error-handler")
require("dotenv").config()

class CryptoTradingBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)
    this.ta = new TechnicalAnalysis()
    this.exchange = new ExchangeManager()
    this.riskManager = new RiskManager()
    this.pairsManager = new PairsManager()
    this.chatId = process.env.CHAT_ID

    // Multiple positions management
    this.activePositions = new Map()
    this.maxConcurrentPositions = Number.parseInt(process.env.MAX_CONCURRENT_POSITIONS) || 3
    this.symbols = process.env.SYMBOLS.split(",").map((s) => s.trim())
    this.tradeAmountPerPair = Number.parseFloat(process.env.TRADE_AMOUNT_PER_PAIR) || 50
    this.isAnalyzing = false

    // Setup error handling
    ErrorHandler.setupGlobalHandlers()
    this.setupErrorHandling()

    this.setupBot()
    this.startAnalysis()
    this.sendWelcomeMessage()
  }

  setupErrorHandling() {
    // Bot-level error handler
    this.bot.catch(async (err, ctx) => {
      const errorType = ErrorHandler.handleTelegramError(err, ctx)

      if (errorType === "MESSAGE_NOT_MODIFIED" && ctx.callbackQuery) {
        try {
          await ctx.answerCbQuery("Already up to date ✅")
        } catch (cbError) {
          console.error("Failed to answer callback query:", cbError.message)
        }
      } else if (errorType === "BLOCKED") {
        console.error("Bot was blocked by user, stopping messages to this chat")
      } else {
        console.error("Bot error handled, continuing operation...")
      }
    })
  }

  async safeEditMessage(ctx, message, options = {}) {
    return await ErrorHandler.safeApiCall(
      async () => {
        if (ctx.callbackQuery) {
          await ctx.editMessageText(message, options)
        } else {
          await ctx.reply(message, options)
        }
      },
      async () => {
        // Fallback: send new message
        await ctx.reply(message, options)
      },
    )
  }

  async safeSendMessage(text, options = {}) {
    return await ErrorHandler.safeApiCall(async () => {
      await this.bot.telegram.sendMessage(this.chatId, text, options)
    })
  }

  async safeAnswerCallback(ctx, text = "Done ✅") {
    return await ErrorHandler.safeApiCall(async () => {
      await ctx.answerCbQuery(text)
    })
  }

  async sendWelcomeMessage() {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("📊 Status", "status"), Markup.button.callback("💼 Positions", "positions")],
      [Markup.button.callback("📈 Analyze Now", "analyze_now"), Markup.button.callback("📋 Pairs", "pairs")],
      [Markup.button.callback("⚙️ Settings", "settings"), Markup.button.callback("📊 Performance", "performance")],
    ])

    const message = `🚀 **Multi-Coin Trading Bot Started!**

📊 **Monitoring Pairs:**
${this.symbols.map((s) => `• ${s}`).join("\n")}

💰 **Configuration:**
• Amount per pair: $${this.tradeAmountPerPair}
• Max positions: ${this.maxConcurrentPositions}
• Timeframe: ${process.env.TIMEFRAME}

🎯 **Signal Requirements:**
• Minimum 3/5 indicators agreement
• 1:1 Risk-Reward ratio
• Real-time monitoring every 30 seconds

✅ **Bot is now actively scanning for signals...**`

    await this.safeSendMessage(message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  setupBot() {
    // Command handlers with error protection
    this.bot.start(async (ctx) => {
      try {
        await this.sendWelcomeMessage()
      } catch (error) {
        console.error("Error in start command:", error.message)
      }
    })

    this.bot.command("now", async (ctx) => {
      try {
        await this.handleAnalyzeNow(ctx)
      } catch (error) {
        console.error("Error in now command:", error.message)
        await ctx.reply("❌ Error analyzing markets. Please try again.")
      }
    })

    this.bot.command("status", async (ctx) => {
      try {
        await this.handleStatus(ctx)
      } catch (error) {
        console.error("Error in status command:", error.message)
        await ctx.reply("❌ Error getting status. Please try again.")
      }
    })

    this.bot.command("positions", async (ctx) => {
      try {
        await this.handlePositions(ctx)
      } catch (error) {
        console.error("Error in positions command:", error.message)
        await ctx.reply("❌ Error getting positions. Please try again.")
      }
    })

    // Callback query handlers with error protection
    this.bot.action("status", async (ctx) => {
      try {
        await this.handleStatus(ctx)
        await this.safeAnswerCallback(ctx)
      } catch (error) {
        console.error("Error in status callback:", error.message)
        await this.safeAnswerCallback(ctx, "Error occurred")
      }
    })

    this.bot.action("positions", async (ctx) => {
      try {
        await this.handlePositions(ctx)
        await this.safeAnswerCallback(ctx)
      } catch (error) {
        console.error("Error in positions callback:", error.message)
        await this.safeAnswerCallback(ctx, "Error occurred")
      }
    })

    this.bot.action("analyze_now", async (ctx) => {
      try {
        await this.handleAnalyzeNow(ctx)
        await this.safeAnswerCallback(ctx)
      } catch (error) {
        console.error("Error in analyze_now callback:", error.message)
        await this.safeAnswerCallback(ctx, "Error occurred")
      }
    })

    this.bot.action("pairs", async (ctx) => {
      try {
        await this.handlePairs(ctx)
        await this.safeAnswerCallback(ctx)
      } catch (error) {
        console.error("Error in pairs callback:", error.message)
        await this.safeAnswerCallback(ctx, "Error occurred")
      }
    })

    this.bot.action("settings", async (ctx) => {
      try {
        await this.handleSettings(ctx)
        await this.safeAnswerCallback(ctx)
      } catch (error) {
        console.error("Error in settings callback:", error.message)
        await this.safeAnswerCallback(ctx, "Error occurred")
      }
    })

    this.bot.action("performance", async (ctx) => {
      try {
        await this.handlePerformance(ctx)
        await this.safeAnswerCallback(ctx)
      } catch (error) {
        console.error("Error in performance callback:", error.message)
        await this.safeAnswerCallback(ctx, "Error occurred")
      }
    })

    // Close and trail position callbacks with error protection
    this.bot.action(/close_(.+)/, async (ctx) => {
      try {
        const symbol = ctx.match[1]
        await this.manualClosePosition(symbol, ctx)
        await this.safeAnswerCallback(ctx)
      } catch (error) {
        console.error("Error in close callback:", error.message)
        await this.safeAnswerCallback(ctx, "Error closing position")
      }
    })

    this.bot.action(/trail_(.+)/, async (ctx) => {
      try {
        const symbol = ctx.match[1]
        await this.trailStopLoss(symbol, ctx)
        await this.safeAnswerCallback(ctx)
      } catch (error) {
        console.error("Error in trail callback:", error.message)
        await this.safeAnswerCallback(ctx, "Error trailing stop")
      }
    })

    this.bot.launch()
    console.log("🚀 Bot started successfully with enhanced error handling!")
  }

  async startAnalysis() {
    console.log("📊 Starting market analysis...")

    // Run analysis every 30 seconds with error protection
    cron.schedule("*/30 * * * * *", async () => {
      if (this.isAnalyzing) return

      try {
        this.isAnalyzing = true
        await this.checkAllPositions()

        if (this.activePositions.size < this.maxConcurrentPositions) {
          await this.analyzeAllMarkets()
        }
      } catch (error) {
        console.error("Analysis error:", error.message)
        // Don't send error messages too frequently
        if (Math.random() < 0.1) {
          // 10% chance to send error message
          await this.safeSendMessage(`⚠️ Analysis error: ${error.message}`)
        }
      } finally {
        this.isAnalyzing = false
      }
    })

    // Send initialization message
    setTimeout(async () => {
      await this.safeSendMessage("✅ Signal system initialized and ready!")
      console.log("📡 Signal system ready")
    }, 10000)
  }

  // Update all handler methods to use safeEditMessage
  async handleAnalyzeNow(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔄 Refresh", "analyze_now"), Markup.button.callback("📊 Status", "status")],
    ])

    let message = "📊 **REAL-TIME MARKET ANALYSIS**\n\n"

    for (const symbol of this.symbols) {
      try {
        const candles = await this.exchange.getCandles(symbol, process.env.TIMEFRAME, 50)
        if (!candles || candles.length < 20) continue

        const currentPrice = candles[candles.length - 1].close
        const signals = await this.ta.analyzeAll(candles)

        const bullishCount = signals.filter((s) => s.signal === "BUY").length
        const bearishCount = signals.filter((s) => s.signal === "SELL").length

        let status = "⚪ NEUTRAL"
        if (bullishCount >= 3) status = "🟢 BULLISH"
        else if (bearishCount >= 3) status = "🔴 BEARISH"

        const positionStatus = this.activePositions.has(symbol) ? "📈 ACTIVE" : "⏳ WAITING"

        message += `💎 **${symbol}** ${positionStatus}\n`
        message += `💰 Price: $${currentPrice.toFixed(4)}\n`
        message += `📊 Signal: ${status} (${Math.max(bullishCount, bearishCount)}/5)\n`
        message += `🔍 Bulls: ${bullishCount} | Bears: ${bearishCount}\n\n`
      } catch (error) {
        message += `💎 **${symbol}**: ❌ Analysis Error\n\n`
      }
    }

    message += `⏰ **Updated:** ${new Date().toLocaleString()}`

    await this.safeEditMessage(ctx, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  async handleStatus(ctx) {
    const activeCount = this.activePositions.size
    const availableSlots = this.maxConcurrentPositions - activeCount

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔄 Refresh", "status"), Markup.button.callback("💼 Positions", "positions")],
      [Markup.button.callback("📈 Analyze Now", "analyze_now")],
    ])

    const message = `📊 **BOT STATUS**

🔄 **Active Positions:** ${activeCount}/${this.maxConcurrentPositions}
💹 **Available Slots:** ${availableSlots}
📈 **Monitoring:** ${this.symbols.length} pairs
⏰ **Timeframe:** ${process.env.TIMEFRAME}

📊 **PAIR STATUS:**
${this.symbols.map((s) => `${this.activePositions.has(s) ? "🟢" : "⚪"} ${s}`).join("\n")}

⏰ **Updated:** ${new Date().toLocaleString()}`

    await this.safeEditMessage(ctx, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  async handlePositions(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔄 Refresh", "positions"), Markup.button.callback("📊 Status", "status")],
      ...Array.from(this.activePositions.keys()).map((symbol) => [
        Markup.button.callback(`Close ${symbol}`, `close_${symbol}`),
        Markup.button.callback(`Trail ${symbol}`, `trail_${symbol}`),
      ]),
    ])

    if (this.activePositions.size === 0) {
      const message = "📭 **No Active Positions**\n\n⏳ Waiting for trading signals..."

      await this.safeEditMessage(ctx, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
      return
    }

    let message = "💼 **ACTIVE POSITIONS**\n\n"

    for (const [symbol, pos] of this.activePositions) {
      const pnlColor = pos.pnl > 0 ? "🟢" : "🔴"
      const pnlAmount = (pos.amount * pos.pnl) / 100

      message += `💎 **${symbol}** (${pos.side})\n`
      message += `💰 Entry: $${pos.entryPrice.toFixed(4)}\n`
      message += `🎯 TP: $${pos.takeProfit.toFixed(4)} | 🛑 SL: $${pos.stopLoss.toFixed(4)}\n`
      message += `${pnlColor} PnL: ${pos.pnl.toFixed(2)}% ($${pnlAmount.toFixed(2)})\n`
      message += `⏰ Duration: ${this.formatDuration(Date.now() - pos.timestamp)}\n\n`
    }

    message += `⏰ **Updated:** ${new Date().toLocaleString()}`

    await this.safeEditMessage(ctx, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  async handlePairs(ctx) {
    const pairStats = this.pairsManager.getAllPairStats()

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔄 Refresh", "pairs"), Markup.button.callback("📊 Performance", "performance")],
    ])

    let message = "📈 **PAIR PERFORMANCE (24h)**\n\n"

    for (const symbol of this.symbols) {
      const stats = pairStats[symbol] || { trades: 0, winRate: 0, totalPnl: 0 }
      const status = this.activePositions.has(symbol) ? "🟢 ACTIVE" : "⚪ WAITING"

      message += `💎 **${symbol}** ${status}\n`
      message += `📊 Trades: ${stats.trades} | Win Rate: ${stats.winRate.toFixed(1)}%\n`
      message += `💰 PnL: ${stats.totalPnl > 0 ? "+" : ""}${stats.totalPnl.toFixed(2)}%\n\n`
    }

    message += `⏰ **Updated:** ${new Date().toLocaleString()}`

    await this.safeEditMessage(ctx, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  async handleSettings(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("📊 Status", "status"), Markup.button.callback("💼 Positions", "positions")],
    ])

    const message = `⚙️ **BOT SETTINGS**

📊 **Configuration:**
• Symbols: ${this.symbols.join(", ")}
• Timeframe: ${process.env.TIMEFRAME}
• Amount per pair: $${this.tradeAmountPerPair}
• Max positions: ${this.maxConcurrentPositions}

🎯 **Signal Settings:**
• Minimum indicators: 3/5
• Risk-Reward: 1:1
• Analysis frequency: 30 seconds

🔔 **Alert Settings:**
• Price updates: Every 1% move
• SL warnings: When 30% away
• TP alerts: At 50% and 75% targets

⏰ **Updated:** ${new Date().toLocaleString()}`

    await this.safeEditMessage(ctx, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  async handlePerformance(ctx) {
    const report = this.pairsManager.getDailyReport()

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🔄 Refresh", "performance"), Markup.button.callback("📋 Pairs", "pairs")],
    ])

    const message = `📊 **DAILY PERFORMANCE**

📈 **Overview:**
• Total Trades: ${report.totalTrades}
• Win Rate: ${report.avgWinRate.toFixed(1)}%
• Total PnL: ${report.totalPnL > 0 ? "+" : ""}${report.totalPnL.toFixed(2)}%

🏆 **Best Performer:** ${report.bestPair || "N/A"}
📉 **Needs Attention:** ${report.worstPair || "N/A"}

💡 **Today's Focus:**
• Monitor ${report.bestPair || "top performers"}
• Review ${report.worstPair || "underperformers"}
• Maintain risk discipline

⏰ **Updated:** ${new Date().toLocaleString()}`

    await this.safeEditMessage(ctx, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  // Continue with other methods using the same error handling pattern...
  // (The rest of the methods remain the same but use safeSendMessage and safeEditMessage)

  async sendMessage(text) {
    await this.safeSendMessage(text, {
      parse_mode: "Markdown",
    })
  }

  // ... (rest of the methods remain the same)
}

// Start the bot with enhanced error handling
const bot = new CryptoTradingBot()

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully...")
  bot.bot.stop("SIGINT")
})

process.once("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully...")
  bot.bot.stop("SIGTERM")
})

console.log("🚀 Bot started with comprehensive error handling!")
