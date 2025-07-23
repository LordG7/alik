import { Telegraf } from "telegraf"
import cron from "node-cron"
import moment from "moment-timezone"
import { TradingBot } from "./bot/TradingBot.js"
import { Logger } from "./utils/Logger.js"
import dotenv from "dotenv"

dotenv.config()

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)
const tradingBot = new TradingBot()
const logger = new Logger()

class MainBot {
  constructor() {
    this.isActive = false
    this.dailyTradeCount = 0
    this.maxDailyTrades = 10
    this.bakuTimezone = "Asia/Baku"
  }

  async start() {
    logger.info("🚀 INJ/USDT Trading Bot başlatılıyor...")

    // Telegram bot komutları
    this.setupTelegramCommands()

    // Ana analiz döngüsü - her 15 saniyede bir çalışır
    cron.schedule("*/15 * * * * *", async () => {
      await this.mainAnalysisLoop()
    })

    // Günlük reset - her gün 09:00'da
    cron.schedule(
      "0 9 * * *",
      () => {
        this.dailyTradeCount = 0
        logger.info("📊 Günlük trade sayacı sıfırlandı")
      },
      {
        timezone: this.bakuTimezone,
      },
    )

    bot.launch()
    logger.info("✅ Bot başarıyla başlatıldı")
  }

  setupTelegramCommands() {
    bot.command("start", (ctx) => {
      ctx.reply(`
🤖 INJ/USDT Trading Bot Aktif!

📊 Özellikler:
• 15 Teknik İndikatör Analizi
• Haber Sentiment Analizi
• Volatilite Tespiti
• Risk Yönetimi
• Günlük Max 10 İşlem

⏰ Çalışma Saatleri: 09:00-23:00 (Bakü Saati)
💰 Hedef Başarı Oranı: %90

Komutlar:
/status - Bot durumu
/analysis - Anlık analiz
/stats - İstatistikler
            `)
    })

    bot.command("status", async (ctx) => {
      const status = await this.getBotStatus()
      ctx.reply(status)
    })

    bot.command("analysis", async (ctx) => {
      const analysis = await tradingBot.performFullAnalysis()
      ctx.reply(this.formatAnalysis(analysis))
    })

    bot.command("stats", async (ctx) => {
      const stats = await tradingBot.getStatistics()
      ctx.reply(this.formatStats(stats))
    })
  }

  async mainAnalysisLoop() {
    try {
      const bakuTime = moment().tz(this.bakuTimezone)
      const hour = bakuTime.hour()

      // Çalışma saatleri kontrolü (09:00-23:00)
      if (hour < 9 || hour >= 23) {
        this.isActive = false
        return
      }

      this.isActive = true

      // Günlük trade limiti kontrolü
      if (this.dailyTradeCount >= this.maxDailyTrades) {
        return
      }

      // Ana analiz
      const analysis = await tradingBot.performFullAnalysis()

      if (analysis.signal && analysis.confidence >= 85) {
        await this.sendTradingSignal(analysis)
        this.dailyTradeCount++
      }

      // Volatilite uyarısı
      if (analysis.volatilityAlert) {
        await this.sendVolatilityAlert(analysis)
      }
    } catch (error) {
      logger.error("Ana analiz döngüsünde hata:", error)
    }
  }

  async sendTradingSignal(analysis) {
    const message = `
🎯 TRADING SİNYALİ - INJ/USDT

📊 Sinyal: ${analysis.signal}
💰 Giriş Fiyatı: $${analysis.entryPrice}
🛑 Stop Loss: $${analysis.stopLoss}
🎯 Take Profit: $${analysis.takeProfit}
📈 Güven Oranı: %${analysis.confidence}

📋 Analiz Detayları:
${analysis.indicators.map((ind) => `• ${ind.name}: ${ind.value} (${ind.signal})`).join("\n")}

⚠️ Risk Seviyesi: ${analysis.riskLevel}
📰 Haber Sentiment: ${analysis.newsSentiment}
😱 Korku/Açgözlülük: ${analysis.fearGreedIndex}

⏰ Zaman: ${moment().tz(this.bakuTimezone).format("DD/MM/YYYY HH:mm:ss")}
        `

    await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message)
    logger.info(`Trading sinyali gönderildi: ${analysis.signal}`)
  }

  async sendVolatilityAlert(analysis) {
    const message = `
⚠️ VOLATİLİTE UYARISI - INJ/USDT

📊 Volatilite Seviyesi: ${analysis.volatilityLevel}
📈 Fiyat Değişimi: %${analysis.priceChange}
📰 Haber Etkisi: ${analysis.newsImpact}

🔍 Detaylar:
${analysis.volatilityReasons.join("\n")}

⏰ ${moment().tz(this.bakuTimezone).format("DD/MM/YYYY HH:mm:ss")}
        `

    await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message)
  }

  async getBotStatus() {
    const bakuTime = moment().tz(this.bakuTimezone)
    return `
📊 Bot Durumu

🟢 Aktif: ${this.isActive ? "Evet" : "Hayır"}
⏰ Bakü Saati: ${bakuTime.format("DD/MM/YYYY HH:mm:ss")}
📈 Günlük İşlem: ${this.dailyTradeCount}/${this.maxDailyTrades}
💰 Coin: INJ/USDT
📊 Timeframe: 15 dakika

🎯 Hedef Başarı: %90
        `
  }

  formatAnalysis(analysis) {
    return `
📊 CANLI ANALİZ - INJ/USDT

💰 Güncel Fiyat: $${analysis.currentPrice}
📈 24s Değişim: %${analysis.priceChange24h}
📊 Volume: ${analysis.volume}

🔍 Teknik İndikatörler:
${analysis.indicators.map((ind) => `${ind.signal === "BUY" ? "🟢" : ind.signal === "SELL" ? "🔴" : "🟡"} ${ind.name}: ${ind.value}`).join("\n")}

📰 Haber Sentiment: ${analysis.newsSentiment}
😱 Korku/Açgözlülük: ${analysis.fearGreedIndex}

⚠️ Genel Değerlendirme: ${analysis.overallSignal}
        `
  }

  formatStats(stats) {
    return `
📊 İSTATİSTİKLER

🎯 Başarı Oranı: %${stats.successRate}
📈 Toplam Sinyal: ${stats.totalSignals}
✅ Başarılı: ${stats.successfulSignals}
❌ Başarısız: ${stats.failedSignals}
💰 Ortalama Kar: %${stats.averageProfit}

📅 Son 7 Gün:
${stats.weeklyStats.map((day) => `${day.date}: %${day.performance}`).join("\n")}
        `
  }
}

const mainBot = new MainBot()
mainBot.start().catch(console.error)
