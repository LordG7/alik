require("dotenv").config()
const { Telegraf, Markup } = require("telegraf")
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

    // 6 coin listesi (INJUSDT dahil)
    this.coins = [
      { symbol: "INJUSDT", name: "Injective Protocol", emoji: "🔥" },
      { symbol: "BTCUSDT", name: "Bitcoin", emoji: "₿" },
      { symbol: "ETHUSDT", name: "Ethereum", emoji: "⟠" },
      { symbol: "BNBUSDT", name: "Binance Coin", emoji: "🟡" },
      { symbol: "ADAUSDT", name: "Cardano", emoji: "🔵" },
      { symbol: "SOLUSDT", name: "Solana", emoji: "🟣" },
    ]

    this.selectedCoin = this.coins[0] // Varsayılan olarak INJUSDT
    this.timeframe = "15m"
    this.isOperatingHours = true
    this.chatId = null
    this.autoAnalysis = true // Otomatik analiz açık/kapalı

    this.setupBot()
    this.setupScheduler()
  }

  setupBot() {
    this.bot.start((ctx) => {
      this.chatId = ctx.chat.id
      ctx.reply(
        `🤖 Kripto Trading Bot Aktif!\n\n📊 Seçili Coin: ${this.selectedCoin.emoji} ${this.selectedCoin.name}\n⏰ Çalışma Saatleri: Her Zaman Aktif\n🎯 Hedef Başarı Oranı: %90\n\n✅ Bot hazır ve sadece Binance API kullanıyor...`,
        this.getMainKeyboard(),
      )
    })

    // Ana menü butonları
    this.bot.hears("📊 Coin Seç", (ctx) => {
      ctx.reply("Hangi coin'i analiz etmek istiyorsunuz?", this.getCoinSelectionKeyboard())
    })

    this.bot.hears("🔄 Anında Analiz", async (ctx) => {
      ctx.reply("🔄 Anında analiz başlatılıyor...")
      await this.performAnalysis(ctx)
    })

    this.bot.hears("📈 Durum", (ctx) => {
      const bakuTime = moment().tz("Asia/Baku").format("DD.MM.YYYY HH:mm:ss")
      const autoStatus = this.autoAnalysis ? "🟢 Açık" : "🔴 Kapalı"
      ctx.reply(
        `📊 Bot Durumu: 🟢 Aktif\n⏰ Bakü Saati: ${bakuTime}\n\n💰 Seçili Coin: ${this.selectedCoin.emoji} ${this.selectedCoin.name}\n🔄 Otomatik Analiz: ${autoStatus}\n\n💡 Sadece Binance API kullanılıyor`,
        this.getMainKeyboard(),
      )
    })

    this.bot.hears("⚙️ Ayarlar", (ctx) => {
      ctx.reply("Bot ayarlarını seçin:", this.getSettingsKeyboard())
    })

    // Coin seçim butonları
    this.coins.forEach((coin) => {
      this.bot.hears(`${coin.emoji} ${coin.name}`, (ctx) => {
        this.selectedCoin = coin
        ctx.reply(
          `✅ Coin değiştirildi!\n\n📊 Yeni Seçim: ${coin.emoji} ${coin.name} (${coin.symbol})\n\n🔄 Anında analiz yapmak ister misiniz?`,
          this.getMainKeyboard(),
        )
      })
    })

    // Ayar butonları
    this.bot.hears("🔄 Otomatik Analiz Aç/Kapat", (ctx) => {
      this.autoAnalysis = !this.autoAnalysis
      const status = this.autoAnalysis ? "🟢 Açıldı" : "🔴 Kapatıldı"
      ctx.reply(`Otomatik analiz ${status}`, this.getSettingsKeyboard())
    })

    this.bot.hears("📊 Tüm Coinleri Analiz Et", async (ctx) => {
      ctx.reply("🔄 Tüm coinler analiz ediliyor...")
      await this.analyzeAllCoins(ctx)
    })

    this.bot.hears("🏠 Ana Menü", (ctx) => {
      ctx.reply("Ana menüye dönüldü", this.getMainKeyboard())
    })

    // Callback query handler
    this.bot.on("callback_query", async (ctx) => {
      const data = ctx.callbackQuery.data

      if (data.startsWith("analyze_")) {
        const symbol = data.replace("analyze_", "")
        const coin = this.coins.find((c) => c.symbol === symbol)
        if (coin) {
          this.selectedCoin = coin
          ctx.answerCbQuery(`${coin.name} analiz ediliyor...`)
          await this.performAnalysis(ctx)
        }
      }
    })

    this.bot.launch()
    console.log("🤖 Telegram Bot başlatıldı...")
  }

  getMainKeyboard() {
    return Markup.keyboard([
      ["📊 Coin Seç", "🔄 Anında Analiz"],
      ["📈 Durum", "⚙️ Ayarlar"],
    ]).resize()
  }

  getCoinSelectionKeyboard() {
    const buttons = []
    for (let i = 0; i < this.coins.length; i += 2) {
      const row = []
      row.push(`${this.coins[i].emoji} ${this.coins[i].name}`)
      if (this.coins[i + 1]) {
        row.push(`${this.coins[i + 1].emoji} ${this.coins[i + 1].name}`)
      }
      buttons.push(row)
    }
    buttons.push(["🏠 Ana Menü"])
    return Markup.keyboard(buttons).resize()
  }

  getSettingsKeyboard() {
    return Markup.keyboard([["🔄 Otomatik Analiz Aç/Kapat"], ["📊 Tüm Coinleri Analiz Et"], ["🏠 Ana Menü"]]).resize()
  }

  setupScheduler() {
    // Her 15 dakikada bir otomatik analiz yap
    cron.schedule("*/15 * * * *", async () => {
      if (this.chatId && this.autoAnalysis) {
        console.log(`🔄 Otomatik analiz: ${this.selectedCoin.symbol}`)
        await this.performAnalysis()
      }
    })
  }

  async analyzeAllCoins(ctx = null) {
    const results = []

    for (const coin of this.coins) {
      try {
        console.log(`📊 ${coin.symbol} analiz ediliyor...`)

        const klines = await this.binanceClient.getKlines(coin.symbol, this.timeframe, 200)
        const currentPrice = await this.binanceClient.getCurrentPrice(coin.symbol)
        const stats24hr = await this.binanceClient.get24hrStats(coin.symbol)

        const technicalSignal = await this.technicalAnalysis.analyze(klines, currentPrice)
        const newsSignal = await this.newsAnalysis.analyze()
        const riskAssessment = this.riskManager.assessRisk(technicalSignal, newsSignal)

        const signal = this.generateTradingSignal(technicalSignal, newsSignal, riskAssessment, currentPrice, stats24hr)

        results.push({
          coin: coin,
          signal: signal,
          shouldTrade: signal.shouldTrade,
        })

        // Kısa bekleme
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`❌ ${coin.symbol} analiz hatası:`, error.message)
        results.push({
          coin: coin,
          signal: null,
          error: error.message,
        })
      }
    }

    await this.sendAllCoinsAnalysis(results, ctx)
  }

  async sendAllCoinsAnalysis(results, ctx = null) {
    let message = "📊 TÜM COİNLER ANALİZ SONUCU\n\n"

    const tradingSignals = []

    for (const result of results) {
      const coin = result.coin

      if (result.error) {
        message += `${coin.emoji} ${coin.name}: ❌ Hata\n`
        continue
      }

      const signal = result.signal
      const direction = signal.direction || "Belirsiz"
      const confidence = signal.confidence

      let status = "⚪"
      if (signal.shouldTrade) {
        status = signal.direction === "LONG" ? "🟢" : "🔴"
        tradingSignals.push(result)
      }

      message += `${status} ${coin.emoji} ${coin.name}\n`
      message += `   💰 $${signal.currentPrice.toFixed(4)}\n`
      message += `   📈 %${signal.priceChange24h.toFixed(2)}\n`
      message += `   🎯 ${direction} (%${confidence})\n\n`
    }

    if (tradingSignals.length > 0) {
      message += `🚨 ${tradingSignals.length} ADET TRADİNG SİNYALİ VAR!\n\n`

      // İnline keyboard ile hızlı analiz butonları
      const inlineButtons = []
      for (const result of tradingSignals) {
        inlineButtons.push([
          Markup.button.callback(`${result.coin.emoji} ${result.coin.name} Analiz Et`, `analyze_${result.coin.symbol}`),
        ])
      }

      if (ctx) {
        ctx.reply(message, Markup.inlineKeyboard(inlineButtons))
      } else if (this.chatId) {
        this.bot.telegram.sendMessage(this.chatId, message, Markup.inlineKeyboard(inlineButtons))
      }
    } else {
      message += "ℹ️ Şu anda güçlü sinyal yok."

      if (ctx) {
        ctx.reply(message, this.getMainKeyboard())
      } else if (this.chatId) {
        this.bot.telegram.sendMessage(this.chatId, message)
      }
    }
  }

  async performAnalysis(ctx = null) {
    try {
      console.log(`📊 ${this.selectedCoin.symbol} analiz başlatılıyor...`)

      const klines = await this.binanceClient.getKlines(this.selectedCoin.symbol, this.timeframe, 200)
      const currentPrice = await this.binanceClient.getCurrentPrice(this.selectedCoin.symbol)
      const stats24hr = await this.binanceClient.get24hrStats(this.selectedCoin.symbol)

      const technicalSignal = await this.technicalAnalysis.analyze(klines, currentPrice)
      const newsSignal = await this.newsAnalysis.analyze()
      const riskAssessment = this.riskManager.assessRisk(technicalSignal, newsSignal)

      const signal = this.generateTradingSignal(technicalSignal, newsSignal, riskAssessment, currentPrice, stats24hr)

      if (signal.shouldTrade) {
        await this.sendTradingSignal(signal, ctx)
      } else if (signal.volatilityAlert) {
        await this.sendVolatilityAlert(signal, ctx)
      } else {
        if (ctx) {
          ctx.reply(
            `📊 ${this.selectedCoin.emoji} ${this.selectedCoin.name} Analiz Sonucu:\n\n💰 Fiyat: $${signal.currentPrice.toFixed(4)}\n📈 24s: %${signal.priceChange24h.toFixed(2)}\n🎯 Güven: %${signal.confidence}\n📈 Yön: ${signal.direction || "Belirsiz"}\n\n💡 Minimum %85 güven gerekli.`,
            this.getMainKeyboard(),
          )
        }
      }
    } catch (error) {
      console.error("❌ Analiz hatası:", error)
      if (ctx) ctx.reply("❌ Analiz sırasında hata oluştu: " + error.message, this.getMainKeyboard())
    }
  }

  generateTradingSignal(technical, news, risk, currentPrice, stats24hr) {
    const signal = {
      timestamp: moment().tz("Asia/Baku").format("DD.MM.YYYY HH:mm:ss"),
      currentPrice: currentPrice,
      priceChange24h: stats24hr.priceChangePercent,
      volume24h: stats24hr.volume,
      high24h: stats24hr.high,
      low24h: stats24hr.low,
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

    // RSI sinyalleri
    if (technical.rsi < 30) technicalScore += 2 // Oversold
    if (technical.rsi > 70) technicalScore -= 2 // Overbought

    // MACD sinyalleri
    if (technical.macdSignal === "BUY") technicalScore += 2
    if (technical.macdSignal === "SELL") technicalScore -= 2

    // Bollinger Bands sinyalleri
    if (technical.bollingerSignal === "BUY") technicalScore += 1
    if (technical.bollingerSignal === "SELL") technicalScore -= 1

    // Stochastic sinyalleri
    if (technical.stochSignal === "BUY") technicalScore += 1
    if (technical.stochSignal === "SELL") technicalScore -= 1

    // EMA sinyalleri
    if (technical.emaSignal === "BUY") technicalScore += 1
    if (technical.emaSignal === "SELL") technicalScore -= 1

    // SMA sinyalleri
    if (technical.smaSignal === "BUY") technicalScore += 1
    if (technical.smaSignal === "SELL") technicalScore -= 1

    // ADX trend gücü
    if (technical.adxSignal === "BUY") technicalScore += 1
    if (technical.adxSignal === "SELL") technicalScore -= 1

    // PSAR sinyalleri
    if (technical.psarSignal === "BUY") technicalScore += 1
    if (technical.psarSignal === "SELL") technicalScore -= 1

    // 24 saatlik değişim etkisi
    if (stats24hr.priceChangePercent > 5) technicalScore += 1 // Güçlü yükseliş
    if (stats24hr.priceChangePercent < -5) technicalScore -= 1 // Güçlü düşüş

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
    signal.reasoning.push(`⚡ RSI: ${technical.rsi.toFixed(2)}`)
    signal.reasoning.push(`📈 MACD: ${technical.macdSignal}`)
    signal.reasoning.push(`🎯 Güven: %${signal.confidence}`)
    signal.reasoning.push(`📊 24s Değişim: %${stats24hr.priceChangePercent.toFixed(2)}`)
    signal.reasoning.push(`📈 24s Yüksek: $${stats24hr.high.toFixed(4)}`)
    signal.reasoning.push(`📉 24s Düşük: $${stats24hr.low.toFixed(4)}`)

    return signal
  }

  async sendTradingSignal(signal, ctx = null) {
    const message = `
🚨 TRADİNG SİNYALİ 🚨

💰 Coin: ${this.selectedCoin.emoji} ${this.selectedCoin.name}
📊 Mevcut Fiyat: $${signal.currentPrice.toFixed(4)}
📈 24s Değişim: %${signal.priceChange24h.toFixed(2)}
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
        `

    if (ctx) {
      ctx.reply(message, this.getMainKeyboard())
    } else if (this.chatId) {
      this.bot.telegram.sendMessage(this.chatId, message)
    }
  }

  async sendVolatilityAlert(signal, ctx = null) {
    const message = `
⚠️ VOLATİLİTE UYARISI ⚠️

💰 Coin: ${this.selectedCoin.emoji} ${this.selectedCoin.name}
📊 Mevcut Fiyat: $${signal.currentPrice.toFixed(4)}
📈 24s Değişim: %${signal.priceChange24h.toFixed(2)}
⏰ Zaman: ${signal.timestamp}

${signal.reasoning.join("\n")}

🚨 Dikkatli olun! Piyasada yüksek volatilite var.
        `

    if (ctx) {
      ctx.reply(message, this.getMainKeyboard())
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
