const { Telegraf, Markup } = require("telegraf")
const Binance = require("binance-api-node").default
const cron = require("node-cron")
const Database = require("./database")
const TechnicalAnalysis = require("./technical-analysis")
const TradingSignals = require("./trading-signals")
const PositionManager = require("./position-manager")
const CoinManager = require("./coin-manager")
const CoinMonitor = require("./coin-monitor")
require("dotenv").config()

class TradingBot {
  constructor() {
    this.bot = new Telegraf(process.env.BOT_TOKEN)
    this.binance = Binance({
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_SECRET_KEY,
      sandbox: false,
    })

    this.db = new Database()
    this.ta = new TechnicalAnalysis(this.binance)
    this.signals = new TradingSignals(this.ta)
    this.positions = new PositionManager(this.binance, this.db)
    this.coinManager = new CoinManager(this.binance)
    this.coinMonitor = new CoinMonitor(this.coinManager, this)

    this.activeUsers = new Set()
    this.userCoins = new Map()
    this.isRunning = false

    this.userSelectedCoins = new Map() // userId -> Set of selected coins
    this.availableCoins = new Set()
    this.volatileCoins = []

    this.activeSignals = new Map() // userId -> Map(symbol -> signalData)
    this.signalCooldowns = new Map() // userId -> Map(symbol -> timestamp)

    this.setupCommands()
    this.setupCronJobs()
    this.setupSignalManagement()
  }

  setupCommands() {
    // Start command
    this.bot.command("start", async (ctx) => {
      const userId = ctx.from.id
      const username = ctx.from.username || ctx.from.first_name

      await this.db.addUser(userId, username)

      const welcomeMessage = `
🚀 *Welcome to Binance Trading Bot!*

This bot provides professional trading signals for Binance futures trading.

*Features:*
• Real-time trading signals (Long/Short)
• Multiple technical indicators analysis
• Stop loss and take profit levels
• 5-15 minute timeframe signals
• Position tracking and PnL monitoring

*Commands:*
/start - Start the bot
/coin - Select trading coin
/status - Check bot status
/positions - View open positions
/pnl - Daily profit/loss
/stop - Stop receiving signals
/help - Show help menu

Click the button below to select your trading coin:
            `

      await ctx.replyWithMarkdown(
        welcomeMessage,
        Markup.inlineKeyboard([
          [Markup.button.callback("📈 Select Coin", "select_coin")],
          [Markup.button.callback("📊 View Positions", "view_positions")],
          [Markup.button.callback("💰 Check PnL", "check_pnl")],
        ]),
      )
    })

    // Coin selection
    this.bot.command("coin", async (ctx) => {
      await this.showCoinSelection(ctx)
    })

    // Status command
    this.bot.command("status", async (ctx) => {
      const userId = ctx.from.id
      const selectedCoins = this.userSelectedCoins.get(userId) || new Set()
      const isActive = this.activeUsers.has(userId)

      const coinStats = await this.coinManager.getCoinStats(Array.from(selectedCoins))

      let coinsStatus = "Not selected"
      if (selectedCoins.size > 0) {
        coinsStatus = Array.from(selectedCoins)
          .map((coin) => {
            const stats = coinStats[coin]
            const changeEmoji = stats && stats.change24h > 0 ? "📈" : "📉"
            const changeText = stats ? ` (${stats.change24h.toFixed(2)}%)` : ""
            return `• ${coin}${changeText} ${changeEmoji}`
          })
          .join("\n")
      }

      const statusMessage = `
📊 *Bot Status*

👤 User: ${ctx.from.first_name}
🔄 Status: ${isActive ? "🟢 Active" : "🔴 Inactive"}
🪙 Selected Coins (${selectedCoins.size}/5):
${coinsStatus}

🤖 Bot Running: ${this.isRunning ? "🟢 Yes" : "🔴 No"}
⏰ Last Update: ${new Date().toLocaleTimeString()}
  `

      await ctx.replyWithMarkdown(
        statusMessage,
        Markup.inlineKeyboard([
          [Markup.button.callback("📈 Change Coins", "select_coin")],
          [Markup.button.callback("📊 View Positions", "view_positions")],
        ]),
      )
    })

    // Positions command
    this.bot.command("positions", async (ctx) => {
      await this.showPositions(ctx)
    })

    // PnL command
    this.bot.command("pnl", async (ctx) => {
      await this.showPnL(ctx)
    })

    // Stop command
    this.bot.command("stop", async (ctx) => {
      const userId = ctx.from.id
      this.activeUsers.delete(userId)
      await ctx.reply("🛑 Stopped receiving trading signals.")
    })

    // Active signals command
    this.bot.command("active", async (ctx) => {
      await this.showActiveSignals(ctx)
    })

    // Help command
    this.bot.command("help", async (ctx) => {
      const helpMessage = `
📚 *Help Menu*

*Commands:*
/start - Initialize the bot
/coin - Select trading coin (e.g., BTCUSDT)
/status - Check current status
/positions - View open positions
/active - View active signals
/pnl - Daily profit/loss report
/stop - Stop receiving signals
/help - Show this help menu

*Signal Management:*
• Only ONE signal per coin at a time
• New signals sent after current ones close
• Signals close on: Take Profit, Stop Loss, or Reversal

*Signal Types:*
🟢 LONG - Buy signal
🔴 SHORT - Sell signal
⚠️ CLOSE - Close position signal
🛑 STOP LOSS - Risk management

*Indicators Used:*
• SuperTrend
• EMA + RSI
• Stochastic
• CCI (Commodity Channel Index)
• VWAP + Bollinger Bands

*Timeframes:* 5m, 15m for optimal signals
            `

      await ctx.replyWithMarkdown(helpMessage)
    })

    // Callback query handlers
    this.bot.action("select_coin", async (ctx) => {
      await this.showCoinSelection(ctx)
    })

    this.bot.action("view_positions", async (ctx) => {
      await this.showPositions(ctx)
    })

    this.bot.action("check_pnl", async (ctx) => {
      await this.showPnL(ctx)
    })

    // Handle coin selection
    this.bot.action(/^coin_(.+)$/, async (ctx) => {
      const coin = ctx.match[1]
      const userId = ctx.from.id

      this.userCoins.set(userId, coin)
      this.activeUsers.add(userId)

      await this.db.updateUserCoin(userId, coin)

      await ctx.editMessageText(`✅ Selected coin: *${coin}*\n\n🚀 Bot is now active and will send trading signals!`, {
        parse_mode: "Markdown",
      })

      // Start monitoring for this user
      this.startMonitoring(userId, coin)
    })

    // Handle coin toggle
    this.bot.action(/^toggle_coin_(.+)$/, async (ctx) => {
      const coin = ctx.match[1]
      const userId = ctx.from.id

      if (!this.userSelectedCoins.has(userId)) {
        this.userSelectedCoins.set(userId, new Set())
      }

      const selectedCoins = this.userSelectedCoins.get(userId)

      if (selectedCoins.has(coin)) {
        selectedCoins.delete(coin)
      } else if (selectedCoins.size < 5) {
        selectedCoins.add(coin)
      } else {
        await ctx.answerCbQuery("❌ Maximum 5 coins allowed!")
        return
      }

      await this.showCoinSelection(ctx)
    })

    // Start trading with selected coins
    this.bot.action("start_trading", async (ctx) => {
      const userId = ctx.from.id
      const selectedCoins = this.userSelectedCoins.get(userId)

      if (!selectedCoins || selectedCoins.size === 0) {
        await ctx.answerCbQuery("❌ Please select at least one coin!")
        return
      }

      this.activeUsers.add(userId)
      await this.db.updateUserCoins(userId, Array.from(selectedCoins))

      const coinsList = Array.from(selectedCoins).join(", ")
      await ctx.editMessageText(
        `✅ Trading started for: *${coinsList}*\n\n🚀 Bot will send signals for your selected coins!`,
        {
          parse_mode: "Markdown",
        },
      )

      // Start monitoring for selected coins
      this.startMonitoringCoins(userId, selectedCoins)
    })

    // Clear all selected coins
    this.bot.action("clear_coins", async (ctx) => {
      const userId = ctx.from.id
      this.userSelectedCoins.set(userId, new Set())
      await this.showCoinSelection(ctx)
    })

    this.bot.action("refresh_coins", async (ctx) => {
      await ctx.answerCbQuery("🔄 Refreshing coin list...")
      await this.coinManager.updateVolatileCoins()
      await this.showCoinSelection(ctx)
    })

    // Handle manual signal closure
    this.bot.action(/^close_(.+)$/, async (ctx) => {
      const symbol = ctx.match[1]
      const userId = ctx.from.id

      try {
        const activeSignal = await this.db.getActiveSignal(userId, symbol)

        if (activeSignal) {
          await this.closeSignal(userId, symbol, "MANUAL_CLOSE", 0, 0)
          await ctx.answerCbQuery("✅ Signal closed manually")
        } else {
          await ctx.answerCbQuery("❌ No active signal found for this coin")
        }
      } catch (error) {
        console.error("Error closing signal manually:", error)
        await ctx.answerCbQuery("❌ Error closing signal")
      }
    })

    // View active signals
    this.bot.action("view_active_signals", async (ctx) => {
      await this.showActiveSignals(ctx)
    })

    // Add this in the setupCommands method after other action handlers

    this.bot.action(/^instructions_(.+)$/, async (ctx) => {
      const symbol = ctx.match[1]
      const userId = ctx.from.id

      try {
        const activeSignal = await this.db.getActiveSignal(userId, symbol)

        if (activeSignal) {
          const signal = {
            symbol: activeSignal.symbol,
            type: activeSignal.signal_type,
            entries: [activeSignal.entry_price],
            stopLoss: activeSignal.stop_loss,
            takeProfits: JSON.parse(activeSignal.take_profit),
            confidence: 85, // Default confidence for active signals
          }

          const instructions = this.generateTradingInstructions(signal)

          await ctx.replyWithMarkdown(
            instructions,
            Markup.inlineKeyboard([
              [Markup.button.url("🚀 Run on Binance", this.generateBinanceUrl(signal))],
              [Markup.button.callback("❌ Close Signal", `close_${symbol}`)],
            ]),
          )
        } else {
          await ctx.answerCbQuery("❌ No active signal found for this coin")
        }
      } catch (error) {
        console.error("Error showing trading instructions:", error)
        await ctx.answerCbQuery("❌ Error loading instructions")
      }
    })
  }

  async showCoinSelection(ctx) {
    const userId = ctx.from.id
    const selectedCoins = this.userSelectedCoins.get(userId) || new Set()

    // Get available coins from coin manager
    const availableCoins = await this.coinManager.getAvailableCoins()
    const coinStats = await this.coinManager.getCoinStats(availableCoins)

    const keyboard = []

    // Create coin selection buttons with stats
    for (let i = 0; i < availableCoins.length; i += 2) {
      const row = []
      for (let j = 0; j < 2 && i + j < availableCoins.length; j++) {
        const coin = availableCoins[i + j]
        const isSelected = selectedCoins.has(coin)
        const emoji = isSelected ? "✅" : "⚪"
        const stats = coinStats[coin]
        const changeEmoji = stats && stats.change24h > 0 ? "📈" : "📉"
        const changeText = stats ? `${stats.change24h.toFixed(2)}%` : ""

        row.push(Markup.button.callback(`${emoji} ${coin} ${changeEmoji}${changeText}`, `toggle_coin_${coin}`))
      }
      keyboard.push(row)
    }

    // Add control buttons
    keyboard.push([
      Markup.button.callback("🚀 Start Trading", "start_trading"),
      Markup.button.callback("🔄 Refresh Coins", "refresh_coins"),
      Markup.button.callback("🗑️ Clear All", "clear_coins"),
    ])

    const selectedList = Array.from(selectedCoins)
      .map((coin) => {
        const stats = coinStats[coin]
        const changeEmoji = stats && stats.change24h > 0 ? "📈" : "📉"
        const changeText = stats ? ` (${stats.change24h.toFixed(2)}%)` : ""
        return `✅ ${coin}${changeText} ${changeEmoji}`
      })
      .join("\n")

    const message = `
📈 *Select Trading Coins* (Max 5)

*Selected: ${selectedCoins.size}/5*
${selectedList || "None selected"}

*Available Coins:*
🔸 INJUSDT (Always available)
🔸 Top 9 most volatile USDT pairs

*Coin Selection Tips:*
• Higher volatility = More trading opportunities
• INJUSDT is specially featured
• Mix different market caps for diversification
  `

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
      })
    } else {
      await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(keyboard))
    }
  }

  async showPositions(ctx) {
    const userId = ctx.from.id
    const selectedCoins = this.userSelectedCoins.get(userId) || new Set()

    if (selectedCoins.size === 0) {
      await ctx.reply("❌ No coins selected. Use /coin to select trading coins first.")
      return
    }

    const positions = await this.positions.getUserPositions(userId)
    const coinStats = await this.coinManager.getCoinStats(Array.from(selectedCoins))

    let message = "📊 *Trading Overview*\n\n"

    // Show selected coins status
    message += "*Selected Coins:*\n"
    for (const coin of selectedCoins) {
      const stats = coinStats[coin]
      const hasPosition = positions.some((pos) => pos.symbol === coin)
      const positionEmoji = hasPosition ? "📈" : "⚪"
      const changeEmoji = stats && stats.change24h > 0 ? "🟢" : "🔴"
      const changeText = stats ? `${stats.change24h.toFixed(2)}%` : "N/A"

      message += `${positionEmoji} *${coin}*: ${changeEmoji} ${changeText}\n`
    }

    if (positions.length === 0) {
      message += "\n📊 No open positions found."
    } else {
      message += "\n*Open Positions:*\n"
      for (const position of positions) {
        const pnl = position.unrealizedPnl > 0 ? "🟢" : "🔴"
        message += `\n${pnl} *${position.symbol}*\n`
        message += `Side: ${position.positionSide}\n`
        message += `Size: ${position.positionAmt}\n`
        message += `Entry: $${position.entryPrice}\n`
        message += `PnL: $${position.unrealizedPnl}\n`
        message += `ROE: ${position.percentage}%\n`
      }
    }

    await ctx.replyWithMarkdown(
      message,
      Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Refresh", "view_positions")],
        [Markup.button.callback("📈 Change Coins", "select_coin")],
      ]),
    )
  }

  async showPnL(ctx) {
    const userId = ctx.from.id
    const pnlData = await this.positions.getDailyPnL(userId)

    const message = `
💰 *Daily P&L Report*

Today's Performance:
${pnlData.totalPnl > 0 ? "🟢" : "🔴"} Total PnL: $${pnlData.totalPnl}
📊 Total Trades: ${pnlData.totalTrades}
✅ Winning Trades: ${pnlData.winningTrades}
❌ Losing Trades: ${pnlData.losingTrades}
📈 Win Rate: ${pnlData.winRate}%

*Top Performing Coins:*
${pnlData.topCoins.map((coin) => `• ${coin.symbol}: $${coin.pnl}`).join("\n")}
        `

    await ctx.replyWithMarkdown(message)
  }

  setupCronJobs() {
    // Check for signals every minute
    cron.schedule("*/1 * * * *", async () => {
      if (this.isRunning && this.activeUsers.size > 0) {
        await this.checkSignals()
      }
    })

    // Update positions every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      if (this.isRunning) {
        await this.updatePositions()
      }
    })
  }

  setupSignalManagement() {
    // Check for signal closures every 30 seconds
    cron.schedule("*/30 * * * * *", async () => {
      if (this.isRunning && this.activeUsers.size > 0) {
        await this.checkSignalClosures()
      }
    })

    // Clean up old closed signals daily
    cron.schedule("0 0 * * *", async () => {
      await this.cleanupOldSignals()
    })
  }

  async checkSignalClosures() {
    for (const userId of this.activeUsers) {
      try {
        const activeSignals = await this.db.getUserActiveSignals(userId)

        for (const activeSignal of activeSignals) {
          await this.checkSignalStatus(userId, activeSignal)
        }
      } catch (error) {
        console.error(`Error checking signal closures for user ${userId}:`, error)
      }
    }
  }

  async checkSignalStatus(userId, activeSignal) {
    try {
      const symbol = activeSignal.symbol
      const klines = await this.ta.getKlines(symbol, "5m", 1)
      const currentPrice = klines[0].close

      const entryPrice = activeSignal.entry_price
      const stopLoss = Number.parseFloat(activeSignal.stop_loss)
      const takeProfits = JSON.parse(activeSignal.take_profit)
      const signalType = activeSignal.signal_type

      let shouldClose = false
      let closeReason = ""
      let pnl = 0

      // Calculate PnL
      if (signalType === "LONG") {
        pnl = ((currentPrice - entryPrice) / entryPrice) * 100

        // Check stop loss
        if (currentPrice <= stopLoss) {
          shouldClose = true
          closeReason = "STOP_LOSS"
        }
        // Check take profits
        else if (currentPrice >= Number.parseFloat(takeProfits[0])) {
          shouldClose = true
          closeReason = "TAKE_PROFIT"
        }
      } else {
        // SHORT
        pnl = ((entryPrice - currentPrice) / entryPrice) * 100

        // Check stop loss
        if (currentPrice >= stopLoss) {
          shouldClose = true
          closeReason = "STOP_LOSS"
        }
        // Check take profits
        else if (currentPrice <= Number.parseFloat(takeProfits[0])) {
          shouldClose = true
          closeReason = "TAKE_PROFIT"
        }
      }

      // Check for reversal signals
      if (!shouldClose) {
        const closeSignal = await this.signals.checkCloseSignal(symbol, {
          side: signalType,
          entryPrice: entryPrice,
        })

        if (closeSignal) {
          shouldClose = true
          closeReason = "REVERSAL_SIGNAL"
        }
      }

      if (shouldClose) {
        await this.closeSignal(userId, symbol, closeReason, pnl, currentPrice)
      }
    } catch (error) {
      console.error(`Error checking signal status for ${activeSignal.symbol}:`, error)
    }
  }

  async closeSignal(userId, symbol, reason, pnl, currentPrice) {
    try {
      // Close the active signal in database
      await this.db.closeActiveSignal(userId, symbol, reason, pnl)

      // Remove from active signals tracking
      if (this.activeSignals.has(userId)) {
        this.activeSignals.get(userId).delete(symbol)
      }

      // Send closure notification
      await this.sendSignalClosure(userId, symbol, reason, pnl, currentPrice)

      console.log(`📊 Signal closed for ${symbol} - User: ${userId}, Reason: ${reason}, PnL: ${pnl.toFixed(2)}%`)
    } catch (error) {
      console.error(`Error closing signal for ${symbol}:`, error)
    }
  }

  async sendSignalClosure(userId, symbol, reason, pnl, currentPrice) {
    const emoji = {
      TAKE_PROFIT: "🎯",
      STOP_LOSS: "🛑",
      REVERSAL_SIGNAL: "⚠️",
      MANUAL_CLOSE: "👤",
    }

    const pnlEmoji = pnl > 0 ? "🟢" : "🔴"
    const reasonText = {
      TAKE_PROFIT: "Take Profit Hit",
      STOP_LOSS: "Stop Loss Hit",
      REVERSAL_SIGNAL: "Reversal Signal",
      MANUAL_CLOSE: "Manual Close",
    }

    const message = `
${emoji[reason]} *SIGNAL CLOSED*

📊 *${symbol}*
💰 Exit Price: $${currentPrice?.toFixed(4) || "N/A"}
📈 P&L: ${pnlEmoji} ${pnl.toFixed(2)}%

🔔 Reason: ${reasonText[reason]}
⏰ Closed: ${new Date().toLocaleTimeString()}

${pnl > 0 ? "🎉 Congratulations on the profit!" : "💪 Better luck next time!"}

✅ *${symbol}* is now ready for new signals!
  `

    try {
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("📊 View Active Signals", "view_active_signals")],
          [Markup.button.callback("💰 Check P&L", "check_pnl")],
        ]).reply_markup,
      })
    } catch (error) {
      console.error(`Error sending closure notification to user ${userId}:`, error)
    }
  }

  async cleanupOldSignals() {
    try {
      // Remove closed signals older than 7 days
      await this.db.db.run(
        "DELETE FROM active_signals WHERE status = 'CLOSED' AND closed_at < datetime('now', '-7 days')",
      )
      console.log("🧹 Cleaned up old closed signals")
    } catch (error) {
      console.error("Error cleaning up old signals:", error)
    }
  }

  async startMonitoring(userId, coin) {
    this.isRunning = true
    console.log(`Started monitoring ${coin} for user ${userId}`)
  }

  async checkSignals() {
    for (const userId of this.activeUsers) {
      const selectedCoins = this.userSelectedCoins.get(userId)
      if (!selectedCoins || selectedCoins.size === 0) continue

      // Initialize user's active signals map if not exists
      if (!this.activeSignals.has(userId)) {
        this.activeSignals.set(userId, new Map())
      }

      for (const coin of selectedCoins) {
        try {
          // Check if there's already an active signal for this coin
          const activeSignal = await this.db.getActiveSignal(userId, coin)

          if (activeSignal) {
            console.log(`⏳ Active signal exists for ${coin} - User: ${userId}, skipping new signal generation`)
            continue
          }

          // Generate new signal only if no active signal exists
          const signal = await this.signals.generateSignal(coin)

          if (signal) {
            const signalId = await this.db.saveSignal(userId, signal)
            await this.db.saveActiveSignal(userId, signal, signalId)

            // Track in memory
            this.activeSignals.get(userId).set(coin, {
              signalId: signalId,
              symbol: coin,
              type: signal.type,
              timestamp: Date.now(),
            })

            await this.sendSignal(userId, signal)
            console.log(`📊 New signal sent for ${coin} - User: ${userId}, Type: ${signal.type}`)
          }
        } catch (error) {
          console.error(`Error checking signals for ${coin}:`, error)
        }
      }
    }
  }

  async sendSignal(userId, signal) {
    const emoji = {
      LONG: "🟢",
      SHORT: "🔴",
      CLOSE: "⚠️",
      STOP_LOSS: "🛑",
    }

    const message = `
${emoji[signal.type]} *${signal.type} SIGNAL*

📊 *${signal.symbol}*
💰 Price: $${signal.price}
⏰ Time: ${signal.timeframe}

📈 *Entry Levels:*
${signal.entries.map((entry) => `• $${entry}`).join("\n")}

🎯 *Take Profit:*
${signal.takeProfits.map((tp, i) => `TP${i + 1}: $${tp}`).join("\n")}

🛑 *Stop Loss:* $${signal.stopLoss}

📊 *Indicators:*
• SuperTrend: ${signal.indicators.supertrend}
• RSI: ${signal.indicators.rsi}
• Stochastic: ${signal.indicators.stochastic}
• CCI: ${signal.indicators.cci}

⚡ *Confidence:* ${signal.confidence}%

🔔 *This signal is now ACTIVE*
⏳ No new signals for ${signal.symbol} until this closes
  `

    try {
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url("🚀 Run on Binance", this.generateBinanceUrl(signal))],
          [
            Markup.button.callback("📊 View Chart", `chart_${signal.symbol}`),
            Markup.button.callback("❌ Close Signal", `close_${signal.symbol}`),
          ],
          [Markup.button.callback("📈 Active Signals", "view_active_signals")],
        ]).reply_markup,
      })
    } catch (error) {
      console.error(`Error sending signal to user ${userId}:`, error)
    }
  }

  async updatePositions() {
    for (const userId of this.activeUsers) {
      try {
        await this.positions.updateUserPositions(userId)
      } catch (error) {
        console.error(`Error updating positions for user ${userId}:`, error)
      }
    }
  }

  async updateVolatileCoins() {
    try {
      const ticker24hr = await this.binance.dailyStats()

      // Filter USDT pairs and sort by price change percentage
      const usdtPairs = ticker24hr
        .filter(
          (coin) =>
            coin.symbol.endsWith("USDT") &&
            !coin.symbol.includes("UP") &&
            !coin.symbol.includes("DOWN") &&
            coin.symbol !== "INJUSDT", // Exclude INJUSDT as it's always included
        )
        .sort(
          (a, b) =>
            Math.abs(Number.parseFloat(b.priceChangePercent)) - Math.abs(Number.parseFloat(a.priceChangePercent)),
        )
        .slice(0, 9)
        .map((coin) => coin.symbol)

      this.volatileCoins = usdtPairs
      console.log("Updated volatile coins:", this.volatileCoins)
    } catch (error) {
      console.error("Error updating volatile coins:", error)
      // Fallback to popular coins
      this.volatileCoins = [
        "BTCUSDT",
        "ETHUSDT",
        "BNBUSDT",
        "ADAUSDT",
        "XRPUSDT",
        "SOLUSDT",
        "DOTUSDT",
        "DOGEUSDT",
        "AVAXUSDT",
      ]
    }
  }

  async startMonitoringCoins(userId, coins) {
    this.isRunning = true
    console.log(`Started monitoring ${Array.from(coins).join(", ")} for user ${userId}`)
  }

  async showActiveSignals(ctx) {
    const userId = ctx.from.id

    try {
      const activeSignals = await this.db.getUserActiveSignals(userId)

      if (activeSignals.length === 0) {
        const message = "📊 *Active Signals*\n\n❌ No active signals found.\n\n✅ All coins are ready for new signals!"

        if (ctx.callbackQuery) {
          await ctx.editMessageText(message, { parse_mode: "Markdown" })
        } else {
          await ctx.replyWithMarkdown(message)
        }
        return
      }

      let message = "📊 *Active Signals*\n\n"

      for (const signal of activeSignals) {
        const emoji = signal.signal_type === "LONG" ? "🟢" : "🔴"
        const timeAgo = Math.floor((Date.now() - new Date(signal.created_at).getTime()) / (1000 * 60))

        message += `${emoji} *${signal.symbol}*\n`
        message += `Type: ${signal.signal_type}\n`
        message += `Entry: $${signal.entry_price}\n`
        message += `Stop Loss: $${signal.stop_loss}\n`
        message += `Active: ${timeAgo}m ago\n\n`
      }

      message += `📈 Total Active: ${activeSignals.length}\n`
      message += `⏳ These coins won't receive new signals until current ones close`

      const keyboard = [
        [Markup.button.callback("🔄 Refresh", "view_active_signals")],
        [Markup.button.callback("📊 View Positions", "view_positions")],
      ]

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
        })
      } else {
        await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(keyboard))
      }
    } catch (error) {
      console.error("Error showing active signals:", error)
      await ctx.reply("❌ Error fetching active signals")
    }
  }

  generateBinanceUrl(signal) {
    // Generate Binance Futures trading URL with pre-filled parameters
    const baseUrl = "https://www.binance.com/en/futures"
    const symbol = signal.symbol.replace("USDT", "_USDT")

    // Create URL with symbol parameter
    const binanceUrl = `${baseUrl}/${symbol}`

    return binanceUrl
  }

  generateTradingInstructions(signal) {
    const side = signal.type === "LONG" ? "Buy/Long" : "Sell/Short"

    return `
📋 *Trading Instructions for ${signal.symbol}*

1️⃣ **Action**: ${side}
2️⃣ **Entry**: ${signal.entries[0]} - ${signal.entries[1] || signal.entries[0]}
3️⃣ **Stop Loss**: ${signal.stopLoss}
4️⃣ **Take Profits**:
   • TP1: ${signal.takeProfits[0]}
   • TP2: ${signal.takeProfits[1]}
   • TP3: ${signal.takeProfits[2]}

⚠️ **Risk Management**:
• Use only 1-2% of your portfolio
• Set stop loss immediately after entry
• Take partial profits at each TP level

🎯 **Confidence**: ${signal.confidence}%
  `
  }

  start() {
    this.bot.launch()
    console.log("🚀 Binance Trading Bot started successfully!")

    // Graceful shutdown
    process.once("SIGINT", () => this.bot.stop("SIGINT"))
    process.once("SIGTERM", () => this.bot.stop("SIGTERM"))
  }
}

// Initialize and start the bot
const tradingBot = new TradingBot()
tradingBot.start()
