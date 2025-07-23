require("dotenv").config()
const { Telegraf } = require("telegraf")
const cron = require("node-cron")
const moment = require("moment-timezone")
const TechnicalAnalysis = require("./technical-analysis")
const NewsAnalysis = require("./news-analysis")
const RiskManager = require("./risk-manager")
const BinanceClient = require("./binance-client")

class CryptoTradingBot {
  constructor() {
    this.bot = new Telegraf(process.env.BOT_TOKEN)
    this.technicalAnalysis = new TechnicalAnalysis()
    this.newsAnalysis = new NewsAnalysis()
    this.riskManager = new RiskManager()
    this.binanceClient = new BinanceClient()

    this.symbol = "INJUSDT"
    this.timeframe = "15m"
    this.dailyTradeCount = 0
    this.maxDailyTrades = 10
    this.isOperatingHours = false
    this.chatId = null

    this.setupBot()
    this.setupScheduler()
  }

  setupBot() {
    this.bot.start((ctx) => {
      this.chatId = ctx.chat.id
      ctx.reply(
        `🤖 Kripto Trading Bot Aktif!\n\n📊 Analiz Edilen Coin: ${this.symbol}\n⏰ Çalışma Saatleri: 09:00-23:00 (Bakü)\n📈 Maksimum Günlük İşlem: ${this.maxDailyTrades}\n🎯 Hedef Başarı Oranı: %90\n\n🔧 KOMUTLAR:\n/status - Bot durumunu göster\n/analyze - Manuel analiz yap\n/now - Anında analiz yap\n\n✅ Bot hazır ve analiz yapıyor...`,
      )
    })

    this.bot.command("status", (ctx) => {
      const bakuTime = moment().tz("Asia/Baku").format("HH:mm:ss")
      const status = this.isOperatingHours ? "🟢 Aktif" : "🔴 Pasif"
      ctx.reply(
        `📊 Bot Durumu: ${status}\n⏰ Bakü Saati: ${bakuTime}\n📈 Günlük İşlem: ${this.dailyTradeCount}/${this.maxDailyTrades}`,
      )
    })

    this.bot.command("analyze", async (ctx) => {
      if (!this.isOperatingHours) {
        ctx.reply("⏰ Bot çalışma saatleri dışında (09:00-23:00 Bakü saati)")
        return
      }
      await this.performAnalysis(ctx)
    })

    this.bot.command("now", async (ctx) => {
      if (!this.isOperatingHours) {
        ctx.reply("⏰ Bot çalışma saatleri dışında (09:00-23:00 Bakü saati)")
        return
      }

      ctx.reply("🔄 Anında analiz başlatılıyor...")
      await this.performAnalysis(ctx)
    })

    this.bot.launch()
    console.log("🤖 Telegram Bot başlatıldı...")
  }

  setupScheduler() {
    // Her 15 dakikada bir analiz yap
    cron.schedule("*/15 * * * *", async () => {
      if (this.isOperatingHours && this.chatId) {
        await this.performAnalysis()
      }
    })

    // Çalışma saatlerini kontrol et (her dakika)
    cron.schedule("* * * * *", () => {
      this.checkOperatingHours()
    })

    // Günlük işlem sayacını sıfırla
    cron.schedule("0 0 * * *", () => {
      this.dailyTradeCount = 0
      console.log("📊 Günlük işlem sayacı sıfırlandı")
    })
  }

  checkOperatingHours() {
    const bakuTime = moment().tz("Asia/Baku")
    const hour = bakuTime.hour()
    const wasOperating = this.isOperatingHours

    this.isOperatingHours = hour >= 9 && hour < 23

    if (!wasOperating && this.isOperatingHours && this.chatId) {
      this.bot.telegram.sendMessage(this.chatId, "🟢 Bot çalışma saatleri başladı! Analiz başlatılıyor...")
    } else if (wasOperating && !this.isOperatingHours && this.chatId) {
      this.bot.telegram.sendMessage(this.chatId, "🔴 Bot çalışma saatleri sona erdi. Yarın 09:00'da tekrar başlayacak.")
    }
  }

  async performAnalysis(ctx = null) {
    try {
      console.log("📊 Analiz başlatılıyor...")

      // Market verilerini al
      const klines = await this.binanceClient.getKlines(this.symbol, this.timeframe, 200)
      const currentPrice = await this.binanceClient.getCurrentPrice(this.symbol)

      // Teknik analiz yap
      const technicalSignal = await this.technicalAnalysis.analyze(klines, currentPrice)

      // Haber analizi yap
      const newsSignal = await this.newsAnalysis.analyze()

      // Risk yönetimi
      const riskAssessment = this.riskManager.assessRisk(technicalSignal, newsSignal)

      // Sinyal oluştur
      const signal = this.generateTradingSignal(technicalSignal, newsSignal, riskAssessment, currentPrice)

      if (signal.shouldTrade && this.dailyTradeCount < this.maxDailyTrades) {
        await this.sendTradingSignal(signal, ctx)
        this.dailyTradeCount++
      } else if (signal.volatilityAlert) {
        await this.sendVolatilityAlert(signal, ctx)
      }
    } catch (error) {
      console.error("❌ Analiz hatası:", error)
      if (ctx) ctx.reply("❌ Analiz sırasında hata oluştu.")
    }
  }

  generateTradingSignal(technical, news, risk, currentPrice) {
    const signal = {
      timestamp: moment().tz("Asia/Baku").format("DD.MM.YYYY HH:mm:ss"),
      currentPrice: currentPrice,
      direction: null,
      confidence: 0,
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      maxRisk: 0,
      shouldTrade: false,
      volatilityAlert: false,
      reasoning: [],
    }

    // Teknik analiz skorunu hesapla
    let technicalScore = 0
    if (technical.rsi < 30) technicalScore += 2 // Oversold
    if (technical.rsi > 70) technicalScore -= 2 // Overbought
    if (technical.macdSignal === "BUY") technicalScore += 2
    if (technical.macdSignal === "SELL") technicalScore -= 2
    if (technical.bollingerSignal === "BUY") technicalScore += 1
    if (technical.bollingerSignal === "SELL") technicalScore -= 1
    if (technical.stochSignal === "BUY") technicalScore += 1
    if (technical.stochSignal === "SELL") technicalScore -= 1

    // Haber etkisini ekle
    technicalScore += news.sentimentScore

    // Volatilite kontrolü
    if (technical.volatility > 0.05) {
      signal.volatilityAlert = true
      signal.reasoning.push(`⚠️ Yüksek volatilite tespit edildi: %${(technical.volatility * 100).toFixed(2)}`)
    }

    // Sinyal yönünü belirle
    if (technicalScore >= 4) {
      signal.direction = "LONG"
      signal.confidence = Math.min(95, 60 + technicalScore * 5)
      signal.entryPrice = currentPrice * 1.001 // %0.1 yukarıda giriş
      signal.stopLoss = currentPrice * 0.985 // %1.5 stop loss
      signal.takeProfit = currentPrice * 1.025 // %2.5 take profit
      signal.maxRisk = currentPrice * 0.98 // Maksimum %2 düşüş riski
    } else if (technicalScore <= -4) {
      signal.direction = "SHORT"
      signal.confidence = Math.min(95, 60 + Math.abs(technicalScore) * 5)
      signal.entryPrice = currentPrice * 0.999 // %0.1 aşağıda giriş
      signal.stopLoss = currentPrice * 1.015 // %1.5 stop loss
      signal.takeProfit = currentPrice * 0.975 // %2.5 take profit
      signal.maxRisk = currentPrice * 1.02 // Maksimum %2 yükseliş riski
    }

    // İşlem yapılıp yapılmayacağını belirle
    signal.shouldTrade = signal.confidence >= 85 && risk.riskLevel <= 3

    // Gerekçeleri ekle
    signal.reasoning.push(`📊 Teknik Skor: ${technicalScore}`)
    signal.reasoning.push(`📰 Haber Skoru: ${news.sentimentScore}`)
    signal.reasoning.push(`⚡ RSI: ${technical.rsi.toFixed(2)}`)
    signal.reasoning.push(`📈 MACD: ${technical.macdSignal}`)
    signal.reasoning.push(`🎯 Güven: %${signal.confidence}`)

    return signal
  }

  async sendTradingSignal(signal, ctx = null) {
    const message = `
🚨 TRADİNG SİNYALİ 🚨

💰 Coin: ${this.symbol}
📊 Mevcut Fiyat: $${signal.currentPrice.toFixed(4)}
⏰ Zaman: ${signal.timestamp}

${signal.direction === "LONG" ? "📈 YÖN: LONG (AL)" : "📉 YÖN: SHORT (SAT)"}
🎯 Güven Oranı: %${signal.confidence}

💵 Giriş Fiyatı: $${signal.entryPrice.toFixed(4)}
🛑 Stop Loss: $${signal.stopLoss.toFixed(4)}
🎯 Take Profit: $${signal.takeProfit.toFixed(4)}
⚠️ Maksimum Risk: $${signal.maxRisk.toFixed(4)}

📋 ANALİZ DETAYLARI:
${signal.reasoning.join("\n")}

⚡ 15 dakika içinde pozisyon ${signal.direction === "LONG" ? "kapatılmalı" : "kapatılmalı"}!

📊 Günlük İşlem: ${this.dailyTradeCount}/${this.maxDailyTrades}
        `

    if (ctx) {
      ctx.reply(message)
    } else if (this.chatId) {
      this.bot.telegram.sendMessage(this.chatId, message)
    }
  }

  async sendVolatilityAlert(signal, ctx = null) {
    const message = `
⚠️ VOLATİLİTE UYARISI ⚠️

💰 Coin: ${this.symbol}
📊 Mevcut Fiyat: $${signal.currentPrice.toFixed(4)}
⏰ Zaman: ${signal.timestamp}

${signal.reasoning.join("\n")}

🚨 Dikkatli olun! Piyasada yüksek volatilite var.
        `

    if (ctx) {
      ctx.reply(message)
    } else if (this.chatId) {
      this.bot.telegram.sendMessage(this.chatId, message)
    }
  }
}

// Bot'u başlat
const bot = new CryptoTradingBot()

// Graceful shutdown
process.once("SIGINT", () => bot.bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.bot.stop("SIGTERM"))
