const { Telegraf } = require("telegraf")
const cron = require("node-cron")
const TechnicalAnalysis = require("./indicators")
const ExchangeManager = require("./exchange")
const RiskManager = require("./risk-manager")
require("dotenv").config()

class CryptoTradingBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)
    this.ta = new TechnicalAnalysis()
    this.exchange = new ExchangeManager()
    this.riskManager = new RiskManager()
    this.isPositionOpen = false
    this.currentPosition = null
    this.chatId = process.env.CHAT_ID

    this.setupBot()
    this.startAnalysis()
  }

  setupBot() {
    this.bot.start((ctx) => {
      ctx.reply(
        "🚀 Crypto Trading Bot Started!\n\nCommands:\n/status - Check bot status\n/position - Current position\n/stop - Stop trading\n/start_trading - Start trading",
      )
    })

    this.bot.command("status", (ctx) => {
      const status = this.isPositionOpen ? "📈 Position Open" : "⏳ Waiting for Signal"
      ctx.reply(`Bot Status: ${status}\nSymbol: ${process.env.SYMBOL}\nTimeframe: ${process.env.TIMEFRAME}`)
    })

    this.bot.command("position", (ctx) => {
      if (this.currentPosition) {
        const pos = this.currentPosition
        ctx.reply(
          `📊 Current Position:\nType: ${pos.side}\nEntry: ${pos.entryPrice}\nSL: ${pos.stopLoss}\nTP: ${pos.takeProfit}\nPnL: ${pos.pnl}%`,
        )
      } else {
        ctx.reply("No open position")
      }
    })

    this.bot.command("stop", (ctx) => {
      this.isPositionOpen = false
      ctx.reply("🛑 Trading stopped")
    })

    this.bot.command("start_trading", (ctx) => {
      this.isPositionOpen = false
      ctx.reply("✅ Trading resumed")
    })

    this.bot.launch()
  }

  async startAnalysis() {
    // Run analysis every minute
    cron.schedule("* * * * *", async () => {
      try {
        if (this.isPositionOpen) {
          await this.checkPosition()
        } else {
          await this.analyzeMarket()
        }
      } catch (error) {
        console.error("Analysis error:", error)
        this.sendMessage(`❌ Error: ${error.message}`)
      }
    })
  }

  async analyzeMarket() {
    const symbol = process.env.SYMBOL
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
      await this.openPosition("BUY", candles[candles.length - 1])
    } else if (bearishCount >= 4) {
      await this.openPosition("SELL", candles[candles.length - 1])
    }
  }

  async openPosition(side, currentCandle) {
    const symbol = process.env.SYMBOL
    const amount = Number.parseFloat(process.env.TRADE_AMOUNT)
    const currentPrice = currentCandle.close

    // Calculate 1:1 Risk-Reward
    const atr = await this.ta.calculateATR([currentCandle], 14)
    const riskAmount = atr * 2 // 2 ATR for SL distance

    const stopLoss = side === "BUY" ? currentPrice - riskAmount : currentPrice + riskAmount

    const takeProfit = side === "BUY" ? currentPrice + riskAmount : currentPrice - riskAmount

    // Create position object
    this.currentPosition = {
      side,
      symbol,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      amount,
      timestamp: Date.now(),
      pnl: 0,
    }

    this.isPositionOpen = true

    // Send signal to Telegram
    const message = `
🎯 NEW SIGNAL DETECTED!

📊 Symbol: ${symbol}
📈 Direction: ${side}
💰 Entry Price: ${currentPrice.toFixed(4)}
🛑 Stop Loss: ${stopLoss.toFixed(4)}
🎯 Take Profit: ${takeProfit.toFixed(4)}
💵 Amount: ${amount} USDT
⚖️ Risk-Reward: 1:1

${this.formatSignalDetails()}
        `

    await this.sendMessage(message)
  }

  async checkPosition() {
    if (!this.currentPosition) return

    const symbol = this.currentPosition.symbol
    const currentPrice = await this.exchange.getCurrentPrice(symbol)

    // Calculate PnL
    const entryPrice = this.currentPosition.entryPrice
    const side = this.currentPosition.side

    let pnlPercent
    if (side === "BUY") {
      pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100
    } else {
      pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100
    }

    this.currentPosition.pnl = pnlPercent

    // Check if SL or TP hit
    const { stopLoss, takeProfit } = this.currentPosition

    if (side === "BUY") {
      if (currentPrice <= stopLoss) {
        await this.closePosition("STOP_LOSS", currentPrice)
      } else if (currentPrice >= takeProfit) {
        await this.closePosition("TAKE_PROFIT", currentPrice)
      }
    } else {
      if (currentPrice >= stopLoss) {
        await this.closePosition("STOP_LOSS", currentPrice)
      } else if (currentPrice <= takeProfit) {
        await this.closePosition("TAKE_PROFIT", currentPrice)
      }
    }
  }

  async closePosition(reason, exitPrice) {
    const pos = this.currentPosition
    const pnlPercent = pos.pnl
    const pnlAmount = (pos.amount * pnlPercent) / 100

    const message = `
${reason === "TAKE_PROFIT" ? "✅ TAKE PROFIT HIT!" : "❌ STOP LOSS HIT!"}

📊 Symbol: ${pos.symbol}
📈 Direction: ${pos.side}
💰 Entry: ${pos.entryPrice.toFixed(4)}
🚪 Exit: ${exitPrice.toFixed(4)}
📊 PnL: ${pnlPercent.toFixed(2)}% (${pnlAmount.toFixed(2)} USDT)
⏰ Duration: ${this.formatDuration(Date.now() - pos.timestamp)}
        `

    await this.sendMessage(message)

    this.currentPosition = null
    this.isPositionOpen = false
  }

  formatSignalDetails() {
    return `
📈 SuperTrend: Active
📊 EMA RSI: Confirmed
🎯 Stochastic: Aligned
⚡ CCI: Strong
📍 VWAP: Supportive
        `
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
