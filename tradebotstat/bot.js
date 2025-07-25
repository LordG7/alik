const { Telegraf, Markup } = require("telegraf")
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
    this.activePositions = new Map()
    this.maxConcurrentPositions = Number.parseInt(process.env.MAX_CONCURRENT_POSITIONS) || 3
    this.symbols = process.env.SYMBOLS.split(",").map((s) => s.trim())
    this.tradeAmountPerPair = Number.parseFloat(process.env.TRADE_AMOUNT_PER_PAIR) || 50
    this.isAnalyzing = false

    this.setupBot()
    this.startAnalysis()
    this.sendWelcomeMessage()
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

    await this.bot.telegram.sendMessage(this.chatId, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  setupBot() {
    // Command handlers
    this.bot.start((ctx) => this.sendWelcomeMessage())

    this.bot.command("now", async (ctx) => {
      await this.handleAnalyzeNow(ctx)
    })

    this.bot.command("status", async (ctx) => {
      await this.handleStatus(ctx)
    })

    this.bot.command("positions", async (ctx) => {
      await this.handlePositions(ctx)
    })

    this.bot.command("close", async (ctx) => {
      const args = ctx.message.text.split(" ")
      if (args.length < 2) {
        const keyboard = Markup.inlineKeyboard(
          Array.from(this.activePositions.keys()).map((symbol) => [
            Markup.button.callback(`Close ${symbol}`, `close_${symbol}`),
          ]),
        )
        ctx.reply("Select position to close:", keyboard)
        return
      }
      const symbol = args[1].toUpperCase()
      await this.manualClosePosition(symbol, ctx)
    })

    // Callback query handlers
    this.bot.action("status", async (ctx) => {
      await this.handleStatus(ctx)
      await ctx.answerCbQuery()
    })

    this.bot.action("positions", async (ctx) => {
      await this.handlePositions(ctx)
      await ctx.answerCbQuery()
    })

    this.bot.action("analyze_now", async (ctx) => {
      await this.handleAnalyzeNow(ctx)
      await ctx.answerCbQuery()
    })

    this.bot.action("pairs", async (ctx) => {
      await this.handlePairs(ctx)
      await ctx.answerCbQuery()
    })

    this.bot.action("settings", async (ctx) => {
      await this.handleSettings(ctx)
      await ctx.answerCbQuery()
    })

    this.bot.action("performance", async (ctx) => {
      await this.handlePerformance(ctx)
      await ctx.answerCbQuery()
    })

    // Close position callbacks
    this.bot.action(/close_(.+)/, async (ctx) => {
      const symbol = ctx.match[1]
      await this.manualClosePosition(symbol, ctx)
      await ctx.answerCbQuery()
    })

    // Trail stop callbacks
    this.bot.action(/trail_(.+)/, async (ctx) => {
      const symbol = ctx.match[1]
      await this.trailStopLoss(symbol, ctx)
      await ctx.answerCbQuery()
    })

    this.bot.launch()
    console.log("🚀 Bot started successfully!")
  }

  async startAnalysis() {
    console.log("📊 Starting market analysis...")

    // Run analysis every 30 seconds
    cron.schedule("*/30 * * * * *", async () => {
      if (this.isAnalyzing) return

      try {
        this.isAnalyzing = true
        await this.checkAllPositions()

        if (this.activePositions.size < this.maxConcurrentPositions) {
          await this.analyzeAllMarkets()
        }
      } catch (error) {
        console.error("Analysis error:", error)
        await this.sendMessage(`❌ Analysis Error: ${error.message}`)
      } finally {
        this.isAnalyzing = false
      }
    })

    // Send a test signal after 10 seconds to verify it's working
    setTimeout(async () => {
      await this.sendMessage("✅ Signal system initialized and ready!")
      console.log("📡 Signal system ready")
    }, 10000)
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
    if (!candles || candles.length < 50) {
      console.log(`❌ Insufficient data for ${symbol}`)
      return
    }

    console.log(`📊 Analyzing ${symbol}...`)

    // Calculate all indicators
    const signals = await this.ta.analyzeAll(candles)

    // Count signals - LOWERED THRESHOLD to 3/5 for more signals
    const bullishCount = signals.filter((s) => s.signal === "BUY").length
    const bearishCount = signals.filter((s) => s.signal === "SELL").length

    console.log(`${symbol}: Bulls=${bullishCount}, Bears=${bearishCount}`)

    if (bullishCount >= 3) {
      console.log(`🟢 LONG signal detected for ${symbol}`)
      await this.openPosition("BUY", symbol, candles[candles.length - 1], signals, bullishCount)
    } else if (bearishCount >= 3) {
      console.log(`🔴 SHORT signal detected for ${symbol}`)
      await this.openPosition("SELL", symbol, candles[candles.length - 1], signals, bearishCount)
    }
  }

  async openPosition(side, symbol, currentCandle, signals, signalStrength) {
    if (this.activePositions.has(symbol)) return
    if (this.activePositions.size >= this.maxConcurrentPositions) return

    const currentPrice = currentCandle.close

    // Calculate 1:1 Risk-Reward using ATR
    const atr = await this.ta.calculateATR([currentCandle], 14)
    const riskAmount = atr * 1.5 // Reduced from 2 to 1.5 for tighter stops

    const stopLoss = side === "BUY" ? currentPrice - riskAmount : currentPrice + riskAmount
    const takeProfit = side === "BUY" ? currentPrice + riskAmount : currentPrice - riskAmount

    // Calculate partial levels
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
      tp1Hit: false,
      tp2Hit: false,
    }

    this.activePositions.set(symbol, position)

    console.log(`✅ Position opened: ${side} ${symbol} at ${currentPrice}`)

    // Send signal to Telegram
    await this.sendTradingSignal(position, signals, signalStrength)

    this.pairsManager.recordTrade(symbol, side, currentPrice)
  }

  async sendTradingSignal(position, signals, signalStrength) {
    const { symbol, side, entryPrice, stopLoss, takeProfit, partialTP1, partialTP2, amount } = position

    const direction = side === "BUY" ? "📈 LONG" : "📉 SHORT"
    const emoji = side === "BUY" ? "🟢" : "🔴"
    const arrow = side === "BUY" ? "⬆️" : "⬇️"

    // Calculate risk metrics
    const riskPercent = Math.abs((entryPrice - stopLoss) / entryPrice) * 100
    const rewardPercent = Math.abs((takeProfit - entryPrice) / entryPrice) * 100

    const signalDetails = signals
      .map((s) => `${this.getIndicatorEmoji(s.indicator)} ${s.indicator}: ${s.signal}`)
      .join("\n")

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(`Close ${symbol}`, `close_${symbol}`),
        Markup.button.callback(`Trail SL`, `trail_${symbol}`),
      ],
      [
        Markup.button.callback("📊 All Positions", "positions"),
        Markup.button.callback("📈 Analyze Now", "analyze_now"),
      ],
    ])

    const message = `🚨 ${emoji} **NEW SIGNAL ALERT** ${emoji}

${arrow} **${symbol} ${direction}**
⚡ **Signal Strength: ${signalStrength}/5** ${this.getStrengthEmoji(signalStrength)}

💰 **ENTRY:** $${entryPrice.toFixed(4)}
🎯 **TAKE PROFIT:** $${takeProfit.toFixed(4)}
🛑 **STOP LOSS:** $${stopLoss.toFixed(4)}

📊 **PARTIAL TARGETS:**
🎯 TP1 (50%): $${partialTP1.toFixed(4)}
🎯 TP2 (75%): $${partialTP2.toFixed(4)}

⚖️ **RISK MANAGEMENT:**
💵 Position: $${amount}
📊 Risk: ${riskPercent.toFixed(2)}%
📈 Reward: ${rewardPercent.toFixed(2)}%
⚖️ R:R: 1:${(rewardPercent / riskPercent).toFixed(1)}

🔍 **TECHNICAL ANALYSIS:**
${signalDetails}

⏰ **Time:** ${new Date().toLocaleString()}
📊 **Active:** ${this.activePositions.size}/${this.maxConcurrentPositions}

${this.getTradingAdvice(side, signalStrength)}`

    await this.bot.telegram.sendMessage(this.chatId, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  async checkAllPositions() {
    if (this.activePositions.size === 0) return

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

        // Check for alerts
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
            await this.sendPartialTPAlert(symbol, "TP1", currentPrice)
          } else if (currentPrice >= partialTP2 && !position.tp2Hit) {
            position.tp2Hit = true
            await this.sendPartialTPAlert(symbol, "TP2", currentPrice)
          }
        } else {
          if (currentPrice >= stopLoss) {
            positionsToClose.push({ symbol, reason: "STOP_LOSS", exitPrice: currentPrice })
          } else if (currentPrice <= takeProfit) {
            positionsToClose.push({ symbol, reason: "TAKE_PROFIT", exitPrice: currentPrice })
          } else if (currentPrice <= partialTP1 && !position.tp1Hit) {
            position.tp1Hit = true
            await this.sendPartialTPAlert(symbol, "TP1", currentPrice)
          } else if (currentPrice <= partialTP2 && !position.tp2Hit) {
            position.tp2Hit = true
            await this.sendPartialTPAlert(symbol, "TP2", currentPrice)
          }
        }
      } catch (error) {
        console.error(`Error checking position for ${symbol}:`, error)
      }
    }

    // Close positions
    for (const closeData of positionsToClose) {
      await this.closePosition(closeData.symbol, closeData.reason, closeData.exitPrice)
    }
  }

  async sendPartialTPAlert(symbol, level, price) {
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(`Close ${symbol}`, `close_${symbol}`),
        Markup.button.callback(`Trail SL`, `trail_${symbol}`),
      ],
    ])

    const message = `🎉 **${level} HIT: ${symbol}**

✅ **Partial Take Profit achieved!**
💰 **Price:** $${price.toFixed(4)}
🎯 **Level:** ${level} (${level === "TP1" ? "50%" : "75%"} target)

💡 **NEXT STEPS:**
• Consider taking ${level === "TP1" ? "25-50%" : "50-75%"} profits
• Move stop loss to breakeven
• Let remaining position run

⏰ **Time:** ${new Date().toLocaleTimeString()}`

    await this.bot.telegram.sendMessage(this.chatId, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  async closePosition(symbol, reason, exitPrice) {
    const pos = this.activePositions.get(symbol)
    if (!pos) return

    const pnlPercent = pos.pnl
    const pnlAmount = (pos.amount * pnlPercent) / 100
    const duration = this.formatDuration(Date.now() - pos.timestamp)

    const isProfit = pnlPercent > 0
    const emoji = reason === "TAKE_PROFIT" ? "✅" : reason === "STOP_LOSS" ? "❌" : "🔄"
    const color = isProfit ? "🟢" : "🔴"

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("📊 All Positions", "positions"),
        Markup.button.callback("📈 Analyze Now", "analyze_now"),
      ],
      [Markup.button.callback("📋 Performance", "performance")],
    ])

    const message = `${emoji} **POSITION CLOSED: ${symbol}**

${color} **RESULT:** ${reason.replace("_", " ")}
📊 **Direction:** ${pos.side}
💰 **Entry:** $${pos.entryPrice.toFixed(4)}
🚪 **Exit:** $${exitPrice.toFixed(4)}
📈 **PnL:** ${pnlPercent.toFixed(2)}% (${pnlAmount > 0 ? "+" : ""}$${pnlAmount.toFixed(2)})
⏰ **Duration:** ${duration}

📊 **PORTFOLIO STATUS:**
• **Remaining Positions:** ${this.activePositions.size - 1}/${this.maxConcurrentPositions}
• **Available Slots:** ${this.maxConcurrentPositions - this.activePositions.size + 1}

${this.getPostTradeAdvice(reason, pnlPercent)}`

    await this.bot.telegram.sendMessage(this.chatId, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })

    console.log(`📊 Position closed: ${symbol} ${reason} PnL: ${pnlPercent.toFixed(2)}%`)

    // Update statistics
    this.pairsManager.recordClose(symbol, reason === "TAKE_PROFIT", pnlPercent)

    // Remove position
    this.activePositions.delete(symbol)
  }

  async checkPositionAlerts(symbol, position, currentPrice) {
    const { side, entryPrice, stopLoss, takeProfit, lastAlertPrice } = position

    // Price movement alerts (every 1% move)
    const priceMovement = Math.abs((currentPrice - lastAlertPrice) / lastAlertPrice) * 100
    if (priceMovement >= 1.0) {
      position.lastAlertPrice = currentPrice
      await this.sendPriceUpdateAlert(symbol, position, currentPrice)
    }

    // Stop Loss proximity warnings
    const slDistance = Math.abs(currentPrice - stopLoss) / Math.abs(entryPrice - stopLoss)
    if (slDistance < 0.3 && position.slWarningsSent < 1) {
      position.slWarningsSent++
      await this.sendStopLossWarning(symbol, position, currentPrice)
    }
  }

  async sendPriceUpdateAlert(symbol, position, currentPrice) {
    const pnlPercent = position.pnl
    const pnlAmount = (position.amount * pnlPercent) / 100
    const emoji = pnlPercent > 0 ? "📈" : "📉"
    const color = pnlPercent > 0 ? "🟢" : "🔴"

    const message = `${emoji} **PRICE UPDATE: ${symbol}**

${color} **Current:** $${currentPrice.toFixed(4)}
📊 **Entry:** $${position.entryPrice.toFixed(4)}
📈 **PnL:** ${pnlPercent.toFixed(2)}% (${pnlAmount > 0 ? "+" : ""}$${pnlAmount.toFixed(2)})

🎯 **Distance to TP:** $${Math.abs(currentPrice - position.takeProfit).toFixed(4)}
🛑 **Distance to SL:** $${Math.abs(currentPrice - position.stopLoss).toFixed(4)}
⏰ **Duration:** ${this.formatDuration(Date.now() - position.timestamp)}`

    await this.sendMessage(message)
  }

  async sendStopLossWarning(symbol, position, currentPrice) {
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(`Close ${symbol}`, `close_${symbol}`),
        Markup.button.callback(`Trail SL`, `trail_${symbol}`),
      ],
    ])

    const message = `⚠️ **STOP LOSS WARNING: ${symbol}**

🚨 **Price approaching Stop Loss!**
📊 **Current:** $${currentPrice.toFixed(4)}
🛑 **Stop Loss:** $${position.stopLoss.toFixed(4)}
📉 **Distance:** $${Math.abs(currentPrice - position.stopLoss).toFixed(4)}

💡 **CONSIDER:**
• Manual exit if trend weakening
• Trailing stop if in profit
• Hold if strong support nearby`

    await this.bot.telegram.sendMessage(this.chatId, message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  // Handler methods
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

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    }
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

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    }
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

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: "Markdown",
          ...keyboard,
        })
      } else {
        await ctx.reply(message, {
          parse_mode: "Markdown",
          ...keyboard,
        })
      }
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

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    }
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

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    }
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

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    }
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

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    }
  }

  async manualClosePosition(symbol, ctx) {
    try {
      const currentPrice = await this.exchange.getCurrentPrice(symbol)
      if (!currentPrice) {
        const message = `❌ Unable to get current price for ${symbol}`
        if (ctx.callbackQuery) {
          await ctx.editMessageText(message)
        } else {
          await ctx.reply(message)
        }
        return
      }

      await this.closePosition(symbol, "MANUAL_CLOSE", currentPrice)

      const message = `✅ Position closed manually for ${symbol} at $${currentPrice.toFixed(4)}`
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message)
      } else {
        await ctx.reply(message)
      }
    } catch (error) {
      const message = `❌ Error closing position: ${error.message}`
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message)
      } else {
        await ctx.reply(message)
      }
    }
  }

  async trailStopLoss(symbol, ctx) {
    const position = this.activePositions.get(symbol)
    if (!position) return

    try {
      const currentPrice = await this.exchange.getCurrentPrice(symbol)
      if (!currentPrice) {
        const message = `❌ Unable to get current price for ${symbol}`
        if (ctx.callbackQuery) {
          await ctx.editMessageText(message)
        } else {
          await ctx.reply(message)
        }
        return
      }

      if (position.pnl > 0) {
        position.stopLoss = position.entryPrice
        const message = `✅ Stop loss trailed to breakeven for ${symbol}`

        if (ctx.callbackQuery) {
          await ctx.editMessageText(message)
        } else {
          await ctx.reply(message)
        }

        await this.sendMessage(`🔄 **STOP LOSS UPDATED: ${symbol}**

🛑 **New Stop Loss:** $${position.stopLoss.toFixed(4)} (Breakeven)
📊 **Current Price:** $${currentPrice.toFixed(4)}
📈 **Protected Profit:** Risk-free trade`)
      } else {
        const message = `⚠️ Position not in profit yet for ${symbol}`
        if (ctx.callbackQuery) {
          await ctx.editMessageText(message)
        } else {
          await ctx.reply(message)
        }
      }
    } catch (error) {
      const message = `❌ Error trailing stop: ${error.message}`
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message)
      } else {
        await ctx.reply(message)
      }
    }
  }

  // Helper methods
  getTradingAdvice(side, signalStrength) {
    const advice = []

    if (signalStrength >= 4) {
      advice.push("🔥 **HIGH CONFIDENCE SIGNAL**")
    } else {
      advice.push("⚠️ **MODERATE SIGNAL**")
    }

    if (side === "BUY") {
      advice.push("📈 **LONG STRATEGY:**")
      advice.push("• Enter on any dip to entry zone")
      advice.push("• Watch for volume confirmation")
    } else {
      advice.push("📉 **SHORT STRATEGY:**")
      advice.push("• Enter on any bounce to entry zone")
      advice.push("• Watch for breakdown confirmation")
    }

    return advice.join("\n")
  }

  getPostTradeAdvice(reason, pnl) {
    if (reason === "TAKE_PROFIT") {
      return "🎉 **SUCCESSFUL TRADE!**\n💡 Strategy working well"
    } else {
      return "📚 **LEARNING OPPORTUNITY**\n💡 Review entry timing"
    }
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

  getStrengthEmoji(strength) {
    if (strength >= 5) return "🔥🔥🔥"
    if (strength >= 4) return "🔥🔥"
    if (strength >= 3) return "🔥"
    return "⚡"
  }

  formatDuration(ms) {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
  }

  async sendMessage(text) {
    try {
      await this.bot.telegram.sendMessage(this.chatId, text, {
        parse_mode: "Markdown",
      })
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
