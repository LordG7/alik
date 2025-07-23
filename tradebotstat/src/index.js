import { Telegraf } from "telegraf"
import { BinanceService } from "./services/BinanceService.js"
import { TechnicalAnalysis } from "./analysis/TechnicalAnalysis.js"
import { Logger } from "./utils/Logger.js"
import dotenv from "dotenv"

dotenv.config()

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)
const binance = new BinanceService()
const technical = new TechnicalAnalysis()
const logger = new Logger()

class TradingSignalBot {
  constructor() {
    this.symbol = "INJUSDT"
  }

  async start() {
    logger.info("🚀 INJ Trading Signal Bot başladı")

    // Telegram komandları
    bot.command("start", (ctx) => {
      ctx.reply(`
🎯 INJ/USDT Trading Signal Bot

Bu bot sizə dəqiq trading siqnalları verir:
• 15 dəqiqə, 30 dəqiqə, 1 saat, 4 saat analizi
• LONG/SHORT yönü
• Maksimum risk səviyyələri
• Likvidasiya qorunması

Komandalar:
/signal - Canlı analiz və siqnal
/help - Kömək
      `)
    })

    bot.command("signal", async (ctx) => {
      try {
        ctx.reply("🔍 Analiz edilir, gözləyin...")
        const signal = await this.getFullSignal()
        ctx.reply(signal)
      } catch (error) {
        ctx.reply("❌ Xəta: " + error.message)
      }
    })

    bot.command("help", (ctx) => {
      ctx.reply(`
📋 Komandalar:
/signal - Tam analiz və trading siqnalı

📊 Nə verir:
• 15dəq, 30dəq, 1saat, 4saat analizi
• LONG/SHORT tövsiyəsi
• Maksimum risk həddləri
• Likvidasiya qorunma səviyyələri

⚠️ Risk: Həmişə stop-loss qoyun!
      `)
    })

    // Hər 5 dəqiqədə avtomatik analiz
    setInterval(
      async () => {
        try {
          const signal = await this.getFullSignal()
          await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, signal)
        } catch (error) {
          logger.error("Avtomatik analiz xətası:", error)
        }
      },
      5 * 60 * 1000,
    ) // 5 dəqiqə

    bot.launch()
    logger.info("✅ Bot hazır!")
  }

  async getFullSignal() {
    try {
      // Müxtəlif timeframe-lər üçün data
      const data15m = await binance.getMarketData(this.symbol, "15m", 50)
      const data30m = await binance.getMarketData(this.symbol, "30m", 50)
      const data1h = await binance.getMarketData(this.symbol, "1h", 50)
      const data4h = await binance.getMarketData(this.symbol, "4h", 50)

      // Hər timeframe üçün analiz
      const signal15m = await technical.getSignal(data15m, "15m")
      const signal30m = await technical.getSignal(data30m, "30m")
      const signal1h = await technical.getSignal(data1h, "1h")
      const signal4h = await technical.getSignal(data4h, "4h")

      // Ümumi qərar
      const finalDecision = this.makeFinalDecision([signal15m, signal30m, signal1h, signal4h])

      // Risk hesablamaları
      const riskLevels = this.calculateRiskLevels(data15m.currentPrice, data4h)

      const currentTime = new Date().toLocaleString("az-AZ", { timeZone: "Asia/Baku" })

      return `
🎯 INJ/USDT TRADING SİQNALI

💰 Cari Qiymət: $${data15m.currentPrice}
⏰ Vaxt: ${currentTime}

📊 TİMEFRAME ANALİZİ:
━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 15 dəqiqə: ${signal15m.direction} (${signal15m.strength}%)
📈 30 dəqiqə: ${signal30m.direction} (${signal30m.strength}%)
📈 1 saat: ${signal1h.direction} (${signal1h.strength}%)
📈 4 saat: ${signal4h.direction} (${signal4h.strength}%)

🎯 ÜMUMİ QƏRAR: ${finalDecision.action}
💪 Güvən: ${finalDecision.confidence}%

${finalDecision.action === "LONG" ? "🟢" : "🔴"} ${finalDecision.action} AÇIN

📊 RİSK SƏVİYYƏLƏRİ:
━━━━━━━━━━━━━━━━━━━━━━━━━━
${
  finalDecision.action === "LONG"
    ? `🔴 LONG üçün maksimum düşüş: $${riskLevels.longMaxDown}
⚠️ Stop Loss: $${riskLevels.longStopLoss}
🎯 Take Profit: $${riskLevels.longTakeProfit}`
    : `🔴 SHORT üçün maksimum yüksəliş: $${riskLevels.shortMaxUp}
⚠️ Stop Loss: $${riskLevels.shortStopLoss}
🎯 Take Profit: $${riskLevels.shortTakeProfit}`
}

⚡ LİKVİDASİYA QORUNMASI:
━━━━━━━━━━━━━━━━━━━━━━━━━━
• Leverage: Maksimum 10x
• Position ölçüsü: Balansın 5%-i
• Stop Loss mütləq qoyun!

${finalDecision.reasoning}

⚠️ Risk xəbərdarlığı: Crypto trading yüksək risklidir!
      `
    } catch (error) {
      logger.error("Signal alma xətası:", error)
      throw error
    }
  }

  makeFinalDecision(signals) {
    let longScore = 0
    let shortScore = 0
    let totalStrength = 0

    // Hər timeframe-in ağırlığı
    const weights = {
      "15m": 1,
      "30m": 2,
      "1h": 3,
      "4h": 4,
    }

    signals.forEach((signal) => {
      const weight = weights[signal.timeframe]
      const strength = signal.strength / 100

      if (signal.direction === "LONG") {
        longScore += weight * strength
      } else if (signal.direction === "SHORT") {
        shortScore += weight * strength
      }

      totalStrength += weight * strength
    })

    const confidence = Math.round((Math.max(longScore, shortScore) / (longScore + shortScore)) * 100)
    const action = longScore > shortScore ? "LONG" : "SHORT"

    // Qərar səbəbi
    let reasoning = "📋 Analiz əsasları:\n"
    signals.forEach((signal) => {
      reasoning += `• ${signal.timeframe}: ${signal.direction} (${signal.reason})\n`
    })

    return {
      action,
      confidence,
      reasoning,
      longScore: longScore.toFixed(2),
      shortScore: shortScore.toFixed(2),
    }
  }

  calculateRiskLevels(currentPrice, data4h) {
    const price = Number.parseFloat(currentPrice)

    // ATR hesabla (volatilite)
    const atr = this.calculateATR(data4h.highs, data4h.lows, data4h.closes, 14)
    const atrValue = atr[atr.length - 1] || price * 0.03

    // Support/Resistance səviyyələri
    const support = Math.min(...data4h.lows.slice(-20))
    const resistance = Math.max(...data4h.highs.slice(-20))

    return {
      // LONG riskləri
      longMaxDown: (price - atrValue * 3).toFixed(4),
      longStopLoss: (price - atrValue * 2).toFixed(4),
      longTakeProfit: (price + atrValue * 3).toFixed(4),

      // SHORT riskləri
      shortMaxUp: (price + atrValue * 3).toFixed(4),
      shortStopLoss: (price + atrValue * 2).toFixed(4),
      shortTakeProfit: (price - atrValue * 3).toFixed(4),

      // Əlavə məlumatlar
      support: support.toFixed(4),
      resistance: resistance.toFixed(4),
      atr: atrValue.toFixed(4),
    }
  }

  calculateATR(highs, lows, closes, period) {
    const trueRanges = []

    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i]
      const tr2 = Math.abs(highs[i] - closes[i - 1])
      const tr3 = Math.abs(lows[i] - closes[i - 1])
      trueRanges.push(Math.max(tr1, tr2, tr3))
    }

    const atr = []
    for (let i = period - 1; i < trueRanges.length; i++) {
      const sum = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      atr.push(sum / period)
    }

    return atr
  }
}

const tradingBot = new TradingSignalBot()
tradingBot.start().catch(console.error)
