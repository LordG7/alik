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
    this.lastAnalysisTime = null
    this.analysisInterval = 15000 // 15 saniye
  }

  async start() {
    try {
      logger.info("🚀 INJ/USDT Trading Bot başlatılıyor...")

      // Bot başlangıç mesajı gönder
      await this.sendStartupMessage()

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
          this.sendDailyResetMessage()
        },
        {
          timezone: this.bakuTimezone,
        },
      )

      // Saatlik durum raporu
      cron.schedule("0 * * * *", async () => {
        await this.sendHourlyReport()
      })

      bot.launch()
      logger.info("✅ Bot başarıyla başlatıldı")

      // Graceful shutdown
      process.once("SIGINT", () => bot.stop("SIGINT"))
      process.once("SIGTERM", () => bot.stop("SIGTERM"))
    } catch (error) {
      logger.error("Bot başlatma hatası:", error)
      process.exit(1)
    }
  }

  async sendStartupMessage() {
    try {
      const message = `
🚀 INJ/USDT Trading Bot Başlatıldı!

⏰ Başlatma Zamanı: ${moment().tz(this.bakuTimezone).format("DD/MM/YYYY HH:mm:ss")}
🎯 Hedef Başarı Oranı: %90
📊 Analiz Sıklığı: Her 15 saniye
💰 Günlük Max İşlem: ${this.maxDailyTrades}

🔍 15 Teknik İndikatör Aktif
📰 Haber Sentiment Analizi Aktif
😱 Korku/Açgözlülük Endeksi Aktif

Bot hazır ve çalışıyor! 🎉
            `
      await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message)
    } catch (error) {
      logger.error("Başlangıç mesajı gönderilemedi:", error)
    }
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
/help - Yardım
            `)
    })

    bot.command("status", async (ctx) => {
      try {
        const status = await this.getBotStatus()
        ctx.reply(status)
      } catch (error) {
        ctx.reply("❌ Durum bilgisi alınamadı: " + error.message)
      }
    })

    bot.command("analysis", async (ctx) => {
      try {
        ctx.reply("🔍 Analiz yapılıyor, lütfen bekleyin...")
        const analysis = await tradingBot.performFullAnalysis()
        ctx.reply(this.formatAnalysis(analysis))
      } catch (error) {
        ctx.reply("❌ Analiz sırasında hata oluştu: " + error.message)
        logger.error("Manuel analiz hatası:", error)
      }
    })

    bot.command("stats", async (ctx) => {
      try {
        const stats = await tradingBot.getStatistics()
        ctx.reply(this.formatStats(stats))
      } catch (error) {
        ctx.reply("❌ İstatistik bilgisi alınamadı: " + error.message)
      }
    })

    bot.command("help", (ctx) => {
      ctx.reply(`
📋 INJ Trading Bot Komutları:

/start - Bot bilgileri ve menü
/status - Bot durumu ve çalışma bilgileri
/analysis - Anlık piyasa analizi (15 indikatör)
/stats - Performans istatistikleri
/help - Bu yardım menüsü

🔔 Otomatik Bildirimler:
• Trading sinyalleri (%85+ güven)
• Volatilite uyarıları
• Günlük raporlar
• Saatlik durum güncellemeleri

⚠️ Not: Bot sadece analiz yapar, işlemler manuel yapılmalıdır.
            `)
    })

    // Hata yakalama
    bot.catch((err, ctx) => {
      logger.error(`Telegram bot hatası: ${err}`)
      ctx.reply("❌ Bir hata oluştu, lütfen tekrar deneyin.")
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

      // Rate limiting - son analizden 15 saniye geçmiş mi?
      const now = Date.now()
      if (this.lastAnalysisTime && now - this.lastAnalysisTime < this.analysisInterval) {
        return
      }

      this.lastAnalysisTime = now

      // Ana analiz
      const analysis = await tradingBot.performFullAnalysis()

      if (analysis.signal && analysis.signal !== "HOLD" && analysis.confidence >= 85) {
        await this.sendTradingSignal(analysis)
        this.dailyTradeCount++

        // İstatistikleri güncelle
        tradingBot.statistics.totalSignals++
      }

      // Volatilite uyarısı
      if (analysis.volatilityAlert) {
        await this.sendVolatilityAlert(analysis)
      }
    } catch (error) {
      logger.error("Ana analiz döngüsünde hata:", error)

      // Kritik hata durumunda bildirim gönder
      if (error.message.includes("ENOTFOUND") || error.message.includes("timeout")) {
        await this.sendErrorAlert("Bağlantı hatası: " + error.message)
      }
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
${analysis.indicators
  .slice(0, 8)
  .map((ind) => `• ${ind.name}: ${ind.value} (${ind.signal})`)
  .join("\n")}

⚠️ Risk Seviyesi: ${analysis.riskLevel}
📰 Haber Sentiment: ${analysis.newsSentiment}
😱 Korku/Açgözlülük: ${analysis.fearGreedIndex}

📊 Günlük İşlem: ${this.dailyTradeCount + 1}/${this.maxDailyTrades}
⏰ Zaman: ${moment().tz(this.bakuTimezone).format("DD/MM/YYYY HH:mm:ss")}
        `

    await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message)
    logger.info(`Trading sinyali gönderildi: ${analysis.signal} - Güven: %${analysis.confidence}`)
  }

  async sendVolatilityAlert(analysis) {
    const message = `
⚠️ VOLATİLİTE UYARISI - INJ/USDT

📊 Volatilite Seviyesi: ${analysis.volatilityLevel}
📈 Fiyat Değişimi: %${analysis.priceChange}
📰 Haber Etkisi: ${analysis.newsImpact || "Normal"}

🔍 Detaylar:
${analysis.volatilityReasons?.join("\n") || "Yüksek volatilite tespit edildi"}

💰 Güncel Fiyat: $${analysis.currentPrice}
⏰ ${moment().tz(this.bakuTimezone).format("DD/MM/YYYY HH:mm:ss")}
        `

    await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message)
    logger.info(`Volatilite uyarısı gönderildi: ${analysis.volatilityLevel}`)
  }

  async sendErrorAlert(errorMessage) {
    try {
      const message = `
❌ BOT HATA UYARISI

🔧 Hata: ${errorMessage}
⏰ Zaman: ${moment().tz(this.bakuTimezone).format("DD/MM/YYYY HH:mm:ss")}

Bot çalışmaya devam ediyor, ancak bu hatayı kontrol edin.
        `
      await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message)
    } catch (telegramError) {
      logger.error("Hata uyarısı gönderilemedi:", telegramError)
    }
  }

  async sendDailyResetMessage() {
    try {
      const message = `
🌅 GÜNLÜK RESET - INJ/USDT Bot

📅 Tarih: ${moment().tz(this.bakuTimezone).format("DD/MM/YYYY")}
🔄 Günlük trade sayacı sıfırlandı
📊 Yeni gün için hazır: 0/${this.maxDailyTrades}

Bot aktif ve analiz yapmaya devam ediyor! 🚀
        `
      await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message)
    } catch (error) {
      logger.error("Günlük reset mesajı gönderilemedi:", error)
    }
  }

  async sendHourlyReport() {
    try {
      if (!this.isActive) return // Sadece aktif saatlerde rapor gönder

      const stats = await tradingBot.getStatistics()
      const bakuTime = moment().tz(this.bakuTimezone)

      const message = `
📊 SAATLİK DURUM RAPORU

⏰ Saat: ${bakuTime.format("HH:mm")} (Bakü)
🎯 Günlük İşlem: ${this.dailyTradeCount}/${this.maxDailyTrades}
📈 Toplam Sinyal: ${stats.totalSignals}
🟢 Bot Durumu: ${this.isActive ? "Aktif" : "Pasif"}

Bot normal çalışıyor ✅
        `

      // Sadece çalışma saatlerinin ilk ve son saatinde gönder
      if (bakuTime.hour() === 9 || bakuTime.hour() === 22) {
        await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message)
      }
    } catch (error) {
      logger.error("Saatlik rapor gönderilemedi:", error)
    }
  }

  async getBotStatus() {
    const bakuTime = moment().tz(this.bakuTimezone)
    const stats = await tradingBot.getStatistics()

    return `
📊 Bot Durumu

🟢 Aktif: ${this.isActive ? "Evet" : "Hayır"}
⏰ Bakü Saati: ${bakuTime.format("DD/MM/YYYY HH:mm:ss")}
📈 Günlük İşlem: ${this.dailyTradeCount}/${this.maxDailyTrades}
💰 Coin: INJ/USDT
📊 Timeframe: 15 dakika

📈 Toplam Sinyal: ${stats.totalSignals}
⏱️ Çalışma Süresi: ${stats.uptime}
🎯 Hedef Başarı: %90

${this.isActive ? "🟢 Bot çalışıyor" : "🔴 Bot çalışma saatleri dışında"}
        `
  }

  formatAnalysis(analysis) {
    return `
📊 CANLI ANALİZ - INJ/USDT

💰 Güncel Fiyat: $${analysis.currentPrice}
📈 24s Değişim: %${analysis.priceChange24h}
📊 Volume: ${Number(analysis.volume).toLocaleString()}

🔍 Teknik İndikatörler (İlk 10):
${analysis.indicators
  .slice(0, 10)
  .map((ind) => `${ind.signal === "BUY" ? "🟢" : ind.signal === "SELL" ? "🔴" : "🟡"} ${ind.name}: ${ind.value}`)
  .join("\n")}

📰 Haber Sentiment: ${analysis.newsSentiment} (${analysis.newsImpact})
😱 Korku/Açgözlülük: ${analysis.fearGreedIndex}
📊 Volatilite: ${analysis.volatilityLevel}

⚠️ Genel Değerlendirme: ${analysis.overallSignal}
🎯 Sinyal: ${analysis.signal} (%${analysis.confidence} güven)
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

⏱️ Çalışma Süresi: ${stats.uptime}
📅 Başlangıç: ${moment(tradingBot.statistics.startTime).tz(this.bakuTimezone).format("DD/MM/YYYY HH:mm")}

🤖 Bot performansı normal seviyelerde
        `
  }
}

const mainBot = new MainBot()
mainBot.start().catch((error) => {
  console.error("Bot başlatma hatası:", error)
  process.exit(1)
})
