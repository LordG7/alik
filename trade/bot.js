const { Telegraf, Markup } = require("telegraf")
const Binance = require("binance-api-node").default
const cron = require("node-cron")
const Database = require("./database")
const TechnicalAnalysis = require("./technical-analysis")
const TradingSignals = require("./trading-signals")
const PositionManager = require("./position-manager")
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

    this.activeUsers = new Set()
    this.userCoins = new Map()
    this.isRunning = false

    this.setupCommands()
    this.setupCronJobs()
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
      const coin = this.userCoins.get(userId)
      const isActive = this.activeUsers.has(userId)

      const statusMessage = `
📊 *Bot Status*

User: ${ctx.from.first_name}
Status: ${isActive ? "🟢 Active" : "🔴 Inactive"}
Selected Coin: ${coin || "Not selected"}
Bot Running: ${this.isRunning ? "🟢 Yes" : "🔴 No"}
            `

      await ctx.replyWithMarkdown(statusMessage)
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

    // Help command
    this.bot.command("help", async (ctx) => {
      const helpMessage = `
📚 *Help Menu*

*Commands:*
/start - Initialize the bot
/coin - Select trading coin (e.g., BTCUSDT)
/status - Check current status
/positions - View open positions
/pnl - Daily profit/loss report
/stop - Stop receiving signals
/help - Show this help menu

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
  }

  async showCoinSelection(ctx) {
    const popularCoins = [
      "BTCUSDT",
      "ETHUSDT",
      "BNBUSDT",
      "ADAUSDT",
      "XRPUSDT",
      "SOLUSDT",
      "DOTUSDT",
      "DOGEUSDT",
      "AVAXUSDT",
      "MATICUSDT",
    ]

    const keyboard = popularCoins.map((coin) => [Markup.button.callback(coin, `coin_${coin}`)])

    const message = `
📈 *Select Trading Coin*

Choose from popular trading pairs:
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
    const positions = await this.positions.getUserPositions(userId)

    if (positions.length === 0) {
      await ctx.reply("📊 No open positions found.")
      return
    }

    let message = "📊 *Open Positions*\n\n"

    for (const position of positions) {
      const pnl = position.unrealizedPnl > 0 ? "🟢" : "🔴"
      message += `${pnl} *${position.symbol}*\n`
      message += `Side: ${position.positionSide}\n`
      message += `Size: ${position.positionAmt}\n`
      message += `Entry: $${position.entryPrice}\n`
      message += `PnL: $${position.unrealizedPnl}\n`
      message += `ROE: ${position.percentage}%\n\n`
    }

    await ctx.replyWithMarkdown(message)
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

  async startMonitoring(userId, coin) {
    this.isRunning = true
    console.log(`Started monitoring ${coin} for user ${userId}`)
  }

  async checkSignals() {
    for (const userId of this.activeUsers) {
      const coin = this.userCoins.get(userId)
      if (!coin) continue

      try {
        const signal = await this.signals.generateSignal(coin)

        if (signal) {
          await this.sendSignal(userId, signal)
          await this.db.saveSignal(userId, signal)
        }
      } catch (error) {
        console.error(`Error checking signals for ${coin}:`, error)
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
        `

    try {
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback("📊 View Chart", `chart_${signal.symbol}`),
            Markup.button.callback("💼 Auto Trade", `auto_${signal.symbol}_${signal.type}`),
          ],
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
