const { Telegraf } = require("telegraf")
const cron = require("node-cron")
const TechnicalAnalysis = require("./indicators")
const ExchangeManager = require("./exchange")
const RiskManager = require("./risk-manager")
const PairsManager = require("./pairs-manager")
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
    this.activePositions = new Map() // symbol -> position data
    this.maxConcurrentPositions = Number.parseInt(process.env.MAX_CONCURRENT_POSITIONS) || 3
    this.symbols = process.env.SYMBOLS.split(",").map((s) => s.trim())
    this.tradeAmountPerPair = Number.parseFloat(process.env.TRADE_AMOUNT_PER_PAIR) || 50

    this.setupBot()
    this.startAnalysis()
    this.sendMessage(
      `🚀 Multi-Coin Trading Bot Started!\n\n📊 Monitoring: ${this.symbols.join(", ")}\n💰 Amount per pair: $${this.tradeAmountPerPair}\n📈 Max positions: ${this.maxConcurrentPositions}`,
    )
  }

  setupBot() {
    this.bot.start((ctx) => {
      ctx.reply(
        `🚀 Multi-Coin Crypto Trading Bot Started!\n\n📊 Monitoring Pairs:\n${this.symbols.map((s) => `• ${s}`).join("\n")}\n\nCommands:\n/status - Check bot status\n/positions - All positions\n/pairs - Pair performance\n/stop - Stop trading\n/start_trading - Start trading`,
      )
    })

    this.bot.command("status", (ctx) => {
      const activeCount = this.activePositions.size
      const availableSlots = this.maxConcurrentPositions - activeCount
      ctx.reply(
        `📊 Bot Status:\n\n` +
          `🔄 Active Positions: ${activeCount}/${this.maxConcurrentPositions}\n` +
          `💹 Available Slots: ${availableSlots}\n` +
          `📈 Monitoring: ${this.symbols.length} pairs\n` +
          `⏰ Timeframe: ${process.env.TIMEFRAME}\n\n` +
          `${this.symbols.map((s) => `${this.activePositions.has(s) ? "🟢" : "⚪"} ${s}`).join("\n")}`,
      )
    })

    this.bot.command("positions", (ctx) => {
      if (this.activePositions.size === 0) {
        ctx.reply("📭 No active positions")
        return
      }

      let message = "📊 Active Positions:\n\n"
      for (const [symbol, pos] of this.activePositions) {
        message += `💎 ${symbol}\n`
        message += `📈 ${pos.side} | Entry: $${pos.entryPrice.toFixed(4)}\n`
        message += `🎯 TP: $${pos.takeProfit.toFixed(4)} | 🛑 SL: $${pos.stopLoss.toFixed(4)}\n`
        message += `📊 PnL: ${pos.pnl.toFixed(2)}% | ⏰ ${this.formatDuration(Date.now() - pos.timestamp)}\n\n`
      }
      ctx.reply(message)
    })

    this.bot.command("pairs", (ctx) => {
      const pairStats = this.pairsManager.getAllPairStats()
      let message = "📈 Pair Performance (24h):\n\n"

      for (const symbol of this.symbols) {
        const stats = pairStats[symbol] || { trades: 0, winRate: 0, pnl: 0 }
        const status = this.activePositions.has(symbol) ? "🟢 ACTIVE" : "⚪ WAITING"
        message += `💎 ${symbol} ${status}\n`
        message += `📊 Trades: ${stats.trades} | Win Rate: ${stats.winRate.toFixed(1)}%\n`
        message += `💰 PnL: ${stats.pnl.toFixed(2)}%\n\n`
      }
      ctx.reply(message)
    })

    this.bot.command("stop", (ctx) => {
      this.activePositions.clear()
      ctx.reply("🛑 All trading stopped")
    })

    this.bot.command("start_trading", (ctx) => {
      ctx.reply("✅ Trading resumed for all pairs")
    })

    this.bot.launch()
  }

  async startAnalysis() {
    // Run analysis every 30 seconds for better responsiveness
    cron.schedule("*/30 * * * * *", async () => {
      try {
        // Check existing positions first
        await this.checkAllPositions()

        // Look for new opportunities if we have available slots
        if (this.activePositions.size < this.maxConcurrentPositions) {
          await this.analyzeAllMarkets()
        }
      } catch (error) {
        console.error("Analysis error:", error)
        this.sendMessage(`❌ Analysis Error: ${error.message}`)
      }
    })
  }

  async analyzeAllMarkets() {
    const availableSymbols = this.symbols.filter((symbol) => !this.activePositions.has(symbol))

    for (const symbol of availableSymbols) {
      if (this.activePositions.size >= this.maxConcurrentPositions) break

      try {
        await this.analyzeSingleMarket(symbol)
      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error)
      }
    }
  }

  async analyzeSingleMarket(symbol) {
    const timeframe = process.env.TIMEFRAME

    // Get market data
    const candles = await this.exchange.getCandles(symbol, timeframe, 100)
    if (!candles || candles.length < 50) return

    // Calculate all indicators
    const signals = await this.ta.analyzeAll(candles)

    // Check if we have a strong signal (4 out of 5 indicators agree)
    const bullishCount = signals.filter((s) => s.signal === "BUY").length
    const bearishCount = signals.filter((s) => s.signal === "SELL").length

    if (bullishCount >= 4) {
      await this.openPosition("BUY", symbol, candles[candles.length - 1], signals, bullishCount)
    } else if (bearishCount >= 4) {
      await this.openPosition("SELL", symbol, candles[candles.length - 1], signals, bearishCount)
    }
  }

  async openPosition(side, symbol, currentCandle, signals, signalStrength) {
    if (this.activePositions.has(symbol)) return
    if (this.activePositions.size >= this.maxConcurrentPositions) return

    const currentPrice = currentCandle.close

    // Calculate 1:1 Risk-Reward using ATR
    const atr = await this.ta.calculateATR([currentCandle], 14)
    const riskAmount = atr * 2 // 2 ATR for SL distance

    const stopLoss = side === "BUY" ? currentPrice - riskAmount : currentPrice + riskAmount
    const takeProfit = side === "BUY" ? currentPrice + riskAmount : currentPrice - riskAmount

    // Create position object
    const position = {
      side,
      symbol,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      amount: this.tradeAmountPerPair,
      timestamp: Date.now(),
      pnl: 0,
      signals: signals,
    }

    this.activePositions.set(symbol, position)

    // Send signal to Telegram
    const signalDetails = signals
      .map((s) => `${this.getIndicatorEmoji(s.indicator)} ${s.indicator}: ${s.signal}`)
      .join("\n")

    const message = `
🎯 NEW SIGNAL: ${symbol}

📊 Direction: ${side === "BUY" ? "📈 LONG" : "📉 SHORT"}
💰 Entry: $${currentPrice.toFixed(4)}
🛑 Stop Loss: $${stopLoss.toFixed(4)}
🎯 Take Profit: $${takeProfit.toFixed(4)}
💵 Amount: $${this.tradeAmountPerPair}
⚖️ Risk-Reward: 1:1

📈 Signal Strength: ${signalStrength}/5

🔍 Indicators:
${signalDetails}

📊 Active Positions: ${this.activePositions.size}/${this.maxConcurrentPositions}
        `

    await this.sendMessage(message)
    this.pairsManager.recordTrade(symbol, side, currentPrice)
  }

  async checkAllPositions() {
    const positionsToClose = []

    for (const [symbol, position] of this.activePositions) {
      try {
        const currentPrice = await this.exchange.getCurrentPrice(symbol)
        if (!currentPrice) continue

        // Calculate PnL
        const entryPrice = position.entryPrice
        const side = position.side

        let pnlPercent
        if (side === "BUY") {
          pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100
        } else {
          pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100
        }

        position.pnl = pnlPercent

        // Check if SL or TP hit
        const { stopLoss, takeProfit } = position

        if (side === "BUY") {
          if (currentPrice <= stopLoss) {
            positionsToClose.push({ symbol, reason: "STOP_LOSS", exitPrice: currentPrice })
          } else if (currentPrice >= takeProfit) {
            positionsToClose.push({ symbol, reason: "TAKE_PROFIT", exitPrice: currentPrice })
          }
        } else {
          if (currentPrice >= stopLoss) {
            positionsToClose.push({ symbol, reason: "STOP_LOSS", exitPrice: currentPrice })
          } else if (currentPrice <= takeProfit) {
            positionsToClose.push({ symbol, reason: "TAKE_PROFIT", exitPrice: currentPrice })
          }
        }
      } catch (error) {
        console.error(`Error checking position for ${symbol}:`, error)
      }
    }

    // Close positions that hit SL or TP
    for (const closeData of positionsToClose) {
      await this.closePosition(closeData.symbol, closeData.reason, closeData.exitPrice)
    }
  }

  async closePosition(symbol, reason, exitPrice) {
    const pos = this.activePositions.get(symbol)
    if (!pos) return

    const pnlPercent = pos.pnl
    const pnlAmount = (pos.amount * pnlPercent) / 100

    const message = `
${reason === "TAKE_PROFIT" ? "✅ TAKE PROFIT HIT!" : "❌ STOP LOSS HIT!"}

💎 ${symbol}
📈 Direction: ${pos.side}
💰 Entry: $${pos.entryPrice.toFixed(4)}
🚪 Exit: $${exitPrice.toFixed(4)}
📊 PnL: ${pnlPercent.toFixed(2)}% (${pnlAmount > 0 ? "+" : ""}$${pnlAmount.toFixed(2)})
⏰ Duration: ${this.formatDuration(Date.now() - pos.timestamp)}

📊 Remaining Positions: ${this.activePositions.size - 1}/${this.maxConcurrentPositions}
        `

    await this.sendMessage(message)

    // Update pair statistics
    this.pairsManager.recordClose(symbol, reason === "TAKE_PROFIT", pnlPercent)

    // Remove position
    this.activePositions.delete(symbol)
  }

  getIndicatorEmoji(indicator) {
    const emojis = {
      SuperTrend: "📈",
      EMA_RSI: "📊",
      Stochastic: "🎯",
      CCI: "⚡",
      VWAP_BB: "📍",
    }
    return emojis[indicator] || "📊"
  }

  formatDuration(ms) {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
  }

  async sendMessage(text) {
    try {
      await this.bot.telegram.sendMessage(this.chatId, text)
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }
}

// Start the bot
const bot = new CryptoTradingBot()

// Graceful shutdown
process.once("SIGINT", () => bot.bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.bot.stop("SIGTERM"))
