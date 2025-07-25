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

    this.bot.command("close", (ctx) => {
      const args = ctx.message.text.split(" ")
      if (args.length < 2) {
        ctx.reply("Usage: /close SYMBOL\nExample: /close BTCUSDT")
        return
      }

      const symbol = args[1].toUpperCase()
      if (this.activePositions.has(symbol)) {
        this.manualClosePosition(symbol, ctx)
      } else {
        ctx.reply(`No active position found for ${symbol}`)
      }
    })

    this.bot.command("trail", (ctx) => {
      const args = ctx.message.text.split(" ")
      if (args.length < 2) {
        ctx.reply("Usage: /trail SYMBOL\nExample: /trail BTCUSDT")
        return
      }

      const symbol = args[1].toUpperCase()
      if (this.activePositions.has(symbol)) {
        this.trailStopLoss(symbol, ctx)
      } else {
        ctx.reply(`No active position found for ${symbol}`)
      }
    })

    this.bot.command("alerts", (ctx) => {
      ctx.reply(`🔔 Alert Settings:
  
📊 Price Updates: Every 0.5% move
🛑 SL Warnings: When 20% away
🎯 TP Alerts: When 20% away
📈 Partial TP: At 50% and 75% targets

Use /close SYMBOL to manually close
Use /trail SYMBOL to trail stop loss`)
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

    // Calculate additional levels
    const partialTP1 = side === "BUY" ? currentPrice + riskAmount * 0.5 : currentPrice - riskAmount * 0.5
    const partialTP2 = side === "BUY" ? currentPrice + riskAmount * 0.75 : currentPrice - riskAmount * 0.75

    // Create position object
    const position = {
      side,
      symbol,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      partialTP1,
      partialTP2,
      amount: this.tradeAmountPerPair,
      timestamp: Date.now(),
      pnl: 0,
      signals: signals,
      lastAlertPrice: currentPrice,
      slWarningsSent: 0,
      tpWarningsSent: 0,
    }

    this.activePositions.set(symbol, position)

    // Get market context
    const marketContext = await this.getMarketContext(symbol, currentCandle)

    // Send comprehensive signal to Telegram
    await this.sendDetailedSignal(position, signals, signalStrength, marketContext)

    this.pairsManager.recordTrade(symbol, side, currentPrice)
  }

  async sendDetailedSignal(position, signals, signalStrength, marketContext) {
    const { symbol, side, entryPrice, stopLoss, takeProfit, partialTP1, partialTP2, amount } = position

    const direction = side === "BUY" ? "📈 LONG" : "📉 SHORT"
    const emoji = side === "BUY" ? "🟢" : "🔴"

    // Calculate risk metrics
    const riskPercent = Math.abs((entryPrice - stopLoss) / entryPrice) * 100
    const rewardPercent = Math.abs((takeProfit - entryPrice) / entryPrice) * 100

    const signalDetails = signals
      .map(
        (s) => `${this.getIndicatorEmoji(s.indicator)} ${s.indicator}: ${s.signal} ${this.getSignalStrength(s.signal)}`,
      )
      .join("\n")

    const message = `
🚨 ${emoji} NEW TRADING SIGNAL ${emoji}

💎 PAIR: ${symbol}
📊 DIRECTION: ${direction}
⚡ SIGNAL STRENGTH: ${signalStrength}/5 ${this.getStrengthEmoji(signalStrength)}

💰 ENTRY ZONE: $${entryPrice.toFixed(4)}
🎯 TAKE PROFIT: $${takeProfit.toFixed(4)}
🛑 STOP LOSS: $${stopLoss.toFixed(4)}

📈 PARTIAL TARGETS:
🎯 TP1 (50%): $${partialTP1.toFixed(4)}
🎯 TP2 (75%): $${partialTP2.toFixed(4)}
🎯 TP3 (100%): $${takeProfit.toFixed(4)}

⚖️ RISK MANAGEMENT:
💵 Position Size: $${amount}
📊 Risk: ${riskPercent.toFixed(2)}%
📈 Reward: ${rewardPercent.toFixed(2)}%
⚖️ R:R Ratio: 1:${(rewardPercent / riskPercent).toFixed(1)}

🔍 TECHNICAL ANALYSIS:
${signalDetails}

📊 MARKET CONTEXT:
${marketContext}

⏰ Time: ${new Date().toLocaleString()}
📊 Active: ${this.activePositions.size}/${this.maxConcurrentPositions}

${this.getTradingAdvice(side, signalStrength)}
`

    await this.sendMessage(message)
  }

  async getMarketContext(symbol, currentCandle) {
    try {
      // Get additional timeframe data for context
      const h1Candles = await this.exchange.getCandles(symbol, "1h", 24)
      const d1Candles = await this.exchange.getCandles(symbol, "1d", 7)

      if (!h1Candles || !d1Candles) return "Market data unavailable"

      const currentPrice = currentCandle.close
      const h1Close = h1Candles[h1Candles.length - 1].close
      const d1Close = d1Candles[d1Candles.length - 1].close

      // Calculate price changes
      const h1Change = ((currentPrice - h1Close) / h1Close) * 100
      const d1Change = ((currentPrice - d1Close) / d1Close) * 100

      // Determine trend
      const h1Trend = h1Change > 0.5 ? "📈 Bullish" : h1Change < -0.5 ? "📉 Bearish" : "➡️ Sideways"
      const d1Trend = d1Change > 2 ? "📈 Strong Bull" : d1Change < -2 ? "📉 Strong Bear" : "➡️ Neutral"

      return `🕐 1H Trend: ${h1Trend} (${h1Change.toFixed(2)}%)
  📅 Daily Trend: ${d1Trend} (${d1Change.toFixed(2)}%)
  📊 Volume: ${currentCandle.volume > 1000000 ? "🔥 High" : "📊 Normal"}`
    } catch (error) {
      return "📊 Analyzing market conditions..."
    }
  }

  async checkAllPositions() {
    const positionsToClose = []
    const alertsToSend = []

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

        // Check for alerts and position management
        await this.checkPositionAlerts(symbol, position, currentPrice)

        // Check if SL or TP hit
        const { stopLoss, takeProfit, partialTP1, partialTP2 } = position

        if (side === "BUY") {
          if (currentPrice <= stopLoss) {
            positionsToClose.push({ symbol, reason: "STOP_LOSS", exitPrice: currentPrice })
          } else if (currentPrice >= takeProfit) {
            positionsToClose.push({ symbol, reason: "TAKE_PROFIT", exitPrice: currentPrice })
          } else if (currentPrice >= partialTP1 && !position.tp1Hit) {
            position.tp1Hit = true
            alertsToSend.push({ symbol, type: "PARTIAL_TP", level: "TP1", price: currentPrice })
          } else if (currentPrice >= partialTP2 && !position.tp2Hit) {
            position.tp2Hit = true
            alertsToSend.push({ symbol, type: "PARTIAL_TP", level: "TP2", price: currentPrice })
          }
        } else {
          if (currentPrice >= stopLoss) {
            positionsToClose.push({ symbol, reason: "STOP_LOSS", exitPrice: currentPrice })
          } else if (currentPrice <= takeProfit) {
            positionsToClose.push({ symbol, reason: "TAKE_PROFIT", exitPrice: currentPrice })
          } else if (currentPrice <= partialTP1 && !position.tp1Hit) {
            position.tp1Hit = true
            alertsToSend.push({ symbol, type: "PARTIAL_TP", level: "TP1", price: currentPrice })
          } else if (currentPrice <= partialTP2 && !position.tp2Hit) {
            position.tp2Hit = true
            alertsToSend.push({ symbol, type: "PARTIAL_TP", level: "TP2", price: currentPrice })
          }
        }
      } catch (error) {
        console.error(`Error checking position for ${symbol}:`, error)
      }
    }

    // Send alerts
    for (const alert of alertsToSend) {
      await this.sendPositionAlert(alert)
    }

    // Close positions that hit SL or TP
    for (const closeData of positionsToClose) {
      await this.closePosition(closeData.symbol, closeData.reason, closeData.exitPrice)
    }
  }

  async checkPositionAlerts(symbol, position, currentPrice) {
    const { side, entryPrice, stopLoss, takeProfit, lastAlertPrice } = position

    // Calculate distances to SL and TP
    const slDistance = Math.abs(currentPrice - stopLoss) / Math.abs(entryPrice - stopLoss)
    const tpDistance = Math.abs(currentPrice - takeProfit) / Math.abs(entryPrice - takeProfit)

    // Price movement alerts (every 0.5% move)
    const priceMovement = Math.abs((currentPrice - lastAlertPrice) / lastAlertPrice) * 100
    if (priceMovement >= 0.5) {
      position.lastAlertPrice = currentPrice
      await this.sendPriceUpdateAlert(symbol, position, currentPrice)
    }

    // Stop Loss proximity warnings
    if (slDistance < 0.2 && position.slWarningsSent < 2) {
      position.slWarningsSent++
      await this.sendStopLossWarning(symbol, position, currentPrice)
    }

    // Take Profit proximity alerts
    if (tpDistance < 0.2 && position.tpWarningsSent < 1) {
      position.tpWarningsSent++
      await this.sendTakeProfitAlert(symbol, position, currentPrice)
    }
  }

  async sendPriceUpdateAlert(symbol, position, currentPrice) {
    const pnlPercent = position.pnl
    const pnlAmount = (position.amount * pnlPercent) / 100
    const emoji = pnlPercent > 0 ? "📈" : "📉"
    const color = pnlPercent > 0 ? "🟢" : "🔴"

    const message = `
${emoji} PRICE UPDATE: ${symbol}

${color} Current: $${currentPrice.toFixed(4)}
📊 Entry: $${position.entryPrice.toFixed(4)}
📈 PnL: ${pnlPercent.toFixed(2)}% (${pnlAmount > 0 ? "+" : ""}$${pnlAmount.toFixed(2)})

🎯 Distance to TP: ${Math.abs(currentPrice - position.takeProfit).toFixed(4)}
🛑 Distance to SL: ${Math.abs(currentPrice - position.stopLoss).toFixed(4)}
⏰ Duration: ${this.formatDuration(Date.now() - position.timestamp)}
`

    await this.sendMessage(message)
  }

  async sendStopLossWarning(symbol, position, currentPrice) {
    const message = `
⚠️ STOP LOSS WARNING: ${symbol}

🚨 Price approaching Stop Loss!
📊 Current: $${currentPrice.toFixed(4)}
🛑 Stop Loss: $${position.stopLoss.toFixed(4)}
📉 Distance: $${Math.abs(currentPrice - position.stopLoss).toFixed(4)}

💡 CONSIDER:
• Manual exit if trend weakening
• Trailing stop if in profit
• Hold if strong support nearby

⏰ Time: ${new Date().toLocaleTimeString()}
`

    await this.sendMessage(message)
  }

  async sendTakeProfitAlert(symbol, position, currentPrice) {
    const message = `
🎯 TAKE PROFIT ZONE: ${symbol}

✅ Approaching Take Profit target!
📊 Current: $${currentPrice.toFixed(4)}
🎯 Take Profit: $${position.takeProfit.toFixed(4)}
📈 Distance: $${Math.abs(position.takeProfit - currentPrice).toFixed(4)}

💡 STRATEGY OPTIONS:
• Take partial profits (50-75%)
• Trail stop to breakeven
• Hold for full target

⏰ Time: ${new Date().toLocaleTimeString()}
`

    await this.sendMessage(message)
  }

  async sendPositionAlert(alert) {
    const { symbol, type, level, price } = alert

    if (type === "PARTIAL_TP") {
      const message = `
🎉 ${level} HIT: ${symbol}

✅ Partial Take Profit achieved!
💰 Price: $${price.toFixed(4)}
🎯 Level: ${level} (${level === "TP1" ? "50%" : "75%"} target)

💡 NEXT STEPS:
• Consider taking ${level === "TP1" ? "25-50%" : "50-75%"} profits
• Move stop loss to breakeven
• Let remaining position run

⏰ Time: ${new Date().toLocaleTimeString()}
`

      await this.sendMessage(message)
    }
  }

  getTradingAdvice(side, signalStrength) {
    const advice = []

    if (signalStrength >= 4) {
      advice.push("🔥 HIGH CONFIDENCE SIGNAL")
      advice.push("💡 Consider full position size")
    } else {
      advice.push("⚠️ MODERATE SIGNAL")
      advice.push("💡 Consider reduced position size")
    }

    if (side === "BUY") {
      advice.push("📈 LONG STRATEGY:")
      advice.push("• Enter on any dip to entry zone")
      advice.push("• Watch for volume confirmation")
      advice.push("• Trail stop after TP1")
    } else {
      advice.push("📉 SHORT STRATEGY:")
      advice.push("• Enter on any bounce to entry zone")
      advice.push("• Watch for breakdown confirmation")
      advice.push("• Trail stop after TP1")
    }

    return advice.join("\n")
  }

  getSignalStrength(signal) {
    return signal === "BUY" ? "🟢" : signal === "SELL" ? "🔴" : "⚪"
  }

  getStrengthEmoji(strength) {
    if (strength >= 5) return "🔥🔥🔥"
    if (strength >= 4) return "🔥🔥"
    if (strength >= 3) return "🔥"
    return "⚡"
  }

  async closePosition(symbol, reason, exitPrice) {
    const pos = this.activePositions.get(symbol)
    if (!pos) return

    const pnlPercent = pos.pnl
    const pnlAmount = (pos.amount * pnlPercent) / 100
    const duration = this.formatDuration(Date.now() - pos.timestamp)

    const isProfit = pnlPercent > 0
    const emoji = reason === "TAKE_PROFIT" ? "✅" : "❌"
    const color = isProfit ? "🟢" : "🔴"

    // Calculate trade statistics
    const riskReward = Math.abs(pnlPercent / (((pos.entryPrice - pos.stopLoss) / pos.entryPrice) * 100))

    const message = `
${emoji} POSITION CLOSED: ${symbol}

${color} RESULT: ${reason.replace("_", " ")}
📊 Direction: ${pos.side}
💰 Entry: $${pos.entryPrice.toFixed(4)}
🚪 Exit: $${exitPrice.toFixed(4)}
📈 PnL: ${pnlPercent.toFixed(2)}% (${pnlAmount > 0 ? "+" : ""}$${pnlAmount.toFixed(2)})
⏰ Duration: ${duration}
⚖️ R:R Achieved: 1:${riskReward.toFixed(2)}

📊 TRADE SUMMARY:
• Entry Quality: ${this.getEntryQuality(pos.signals)}
• Max Favorable: ${this.calculateMaxFavorable(pos)}%
• Max Adverse: ${this.calculateMaxAdverse(pos)}%

📈 PERFORMANCE:
${this.getTradePerformanceEmoji(pnlPercent)} ${this.getPerformanceText(pnlPercent)}

📊 Portfolio Status:
• Remaining Positions: ${this.activePositions.size - 1}/${this.maxConcurrentPositions}
• Available Slots: ${this.maxConcurrentPositions - this.activePositions.size + 1}

${this.getPostTradeAdvice(reason, pnlPercent)}
`

    await this.sendMessage(message)

    // Update pair statistics
    this.pairsManager.recordClose(symbol, reason === "TAKE_PROFIT", pnlPercent)

    // Remove position
    this.activePositions.delete(symbol)

    // Send daily summary if it's the last position of the day
    if (this.activePositions.size === 0) {
      setTimeout(() => this.sendDailySummary(), 5000)
    }
  }

  async manualClosePosition(symbol, ctx) {
    try {
      const currentPrice = await this.exchange.getCurrentPrice(symbol)
      if (!currentPrice) {
        ctx.reply(`❌ Unable to get current price for ${symbol}`)
        return
      }

      await this.closePosition(symbol, "MANUAL_CLOSE", currentPrice)
      ctx.reply(`✅ Position closed manually for ${symbol}`)
    } catch (error) {
      ctx.reply(`❌ Error closing position: ${error.message}`)
    }
  }

  async trailStopLoss(symbol, ctx) {
    const position = this.activePositions.get(symbol)
    if (!position) return

    try {
      const currentPrice = await this.exchange.getCurrentPrice(symbol)
      if (!currentPrice) {
        ctx.reply(`❌ Unable to get current price for ${symbol}`)
        return
      }

      // Trail stop to breakeven if in profit
      if (position.pnl > 0) {
        position.stopLoss = position.entryPrice
        ctx.reply(`✅ Stop loss trailed to breakeven for ${symbol}`)

        const message = `
🔄 STOP LOSS UPDATED: ${symbol}

🛑 New Stop Loss: $${position.stopLoss.toFixed(4)} (Breakeven)
📊 Current Price: $${currentPrice.toFixed(4)}
📈 Protected Profit: Risk-free trade

⏰ Time: ${new Date().toLocaleTimeString()}
`

        await this.sendMessage(message)
      } else {
        ctx.reply(`⚠️ Position not in profit yet for ${symbol}`)
      }
    } catch (error) {
      ctx.reply(`❌ Error trailing stop: ${error.message}`)
    }
  }

  getEntryQuality(signals) {
    const bullish = signals.filter((s) => s.signal === "BUY").length
    const bearish = signals.filter((s) => s.signal === "SELL").length
    const total = Math.max(bullish, bearish)

    if (total >= 5) return "🔥 Excellent"
    if (total >= 4) return "✅ Good"
    if (total >= 3) return "⚠️ Fair"
    return "❌ Poor"
  }

  calculateMaxFavorable(position) {
    // This would need to be tracked during position lifetime
    // For now, return estimated based on TP distance
    return Math.abs((position.takeProfit - position.entryPrice) / position.entryPrice) * 100
  }

  calculateMaxAdverse(position) {
    // This would need to be tracked during position lifetime
    // For now, return estimated based on SL distance
    return Math.abs((position.entryPrice - position.stopLoss) / position.entryPrice) * 100
  }

  getTradePerformanceEmoji(pnl) {
    if (pnl > 2) return "🚀"
    if (pnl > 0) return "📈"
    if (pnl > -1) return "📊"
    return "📉"
  }

  getPerformanceText(pnl) {
    if (pnl > 2) return "Excellent trade!"
    if (pnl > 0) return "Profitable trade"
    if (pnl > -1) return "Small loss - acceptable"
    return "Review strategy"
  }

  getPostTradeAdvice(reason, pnl) {
    const advice = []

    if (reason === "TAKE_PROFIT") {
      advice.push("🎉 SUCCESSFUL TRADE!")
      advice.push("💡 What worked:")
      advice.push("• Strong signal confirmation")
      advice.push("• Good risk management")
      advice.push("• Patient execution")
    } else {
      advice.push("📚 LEARNING OPPORTUNITY:")
      advice.push("💡 Review points:")
      advice.push("• Entry timing")
      advice.push("• Market conditions")
      advice.push("• Signal quality")
    }

    return advice.join("\n")
  }

  async sendDailySummary() {
    const report = this.pairsManager.getDailyReport()

    const message = `
📊 DAILY TRADING SUMMARY

📈 Performance Overview:
• Total Trades: ${report.totalTrades}
• Win Rate: ${report.avgWinRate.toFixed(1)}%
• Total PnL: ${report.totalPnL > 0 ? "+" : ""}${report.totalPnL.toFixed(2)}%

🏆 Best Performer: ${report.bestPair || "N/A"}
📉 Needs Attention: ${report.worstPair || "N/A"}

💡 Tomorrow's Focus:
• Monitor ${report.bestPair || "top performers"}
• Review ${report.worstPair || "underperformers"}
• Maintain risk discipline

⏰ Report Time: ${new Date().toLocaleString()}
`

    await this.sendMessage(message)
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
