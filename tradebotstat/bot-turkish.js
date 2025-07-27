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

    // Çoklu pozisyon yönetimi
    this.activePositions = new Map()
    this.maxConcurrentPositions = Number.parseInt(process.env.MAX_CONCURRENT_POSITIONS) || 3
    this.symbols = process.env.SYMBOLS.split(",").map((s) => s.trim())
    this.tradeAmountPerPair = Number.parseFloat(process.env.TRADE_AMOUNT_PER_PAIR) || 50
    this.isAnalyzing = false

    // Hata yönetimini kur
    this.setupErrorHandling()
    this.setupBot()
    this.startAnalysis()
    this.sendWelcomeMessage()
  }

  setupErrorHandling() {
    // Bot seviyesi hata yöneticisi
    this.bot.catch(async (err, ctx) => {
      console.error("Bot hatası:", err.message)
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCbQuery("Hata oluştu")
        } catch (cbError) {
          console.error("Callback sorgusu yanıtlanamadı:", cbError.message)
        }
      }
    })

    // Global hata yöneticileri
    process.on("uncaughtException", (error) => {
      console.error("🚨 Yakalanmamış İstisna:", error.message)
      // Çıkma - botu çalışır durumda tut
    })

    process.on("unhandledRejection", (reason, promise) => {
      console.error("🚨 İşlenmemiş Red:", reason)
      // Çıkma - botu çalışır durumda tut
    })
  }

  async safeEditMessage(ctx, message, options = {}) {
    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, options)
      } else {
        await ctx.reply(message, options)
      }
    } catch (error) {
      if (
        error.response &&
        error.response.description &&
        error.response.description.includes("message is not modified")
      ) {
        // Mesaj içeriği aynı, sadece callback sorgusunu yanıtla
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery("Zaten güncel ✅")
        }
      } else {
        console.error("Mesaj düzenleme hatası:", error.message)
        // Bunun yerine yeni mesaj göndermeyi dene
        try {
          await ctx.reply(message, options)
        } catch (fallbackError) {
          console.error("Yedek mesaj başarısız:", fallbackError.message)
        }
      }
    }
  }

  async safeSendMessage(text, options = {}) {
    try {
      await this.bot.telegram.sendMessage(this.chatId, text, options)
    } catch (error) {
      console.error("Mesaj gönderme hatası:", error.message)
    }
  }

  async sendWelcomeMessage() {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("📊 Durum", "status"), Markup.button.callback("💼 Pozisyonlar", "positions")],
      [Markup.button.callback("📈 Şimdi Analiz Et", "analyze_now"), Markup.button.callback("📋 Çiftler", "pairs")],
      [Markup.button.callback("⚙️ Ayarlar", "settings"), Markup.button.callback("📊 Performans", "performance")],
    ])

    const message = `🚀 **Çoklu Coin Trading Botu Başlatıldı!**

📊 **İzlenen Çiftler:**
${this.symbols.map((s) => `• ${s}`).join("\n")}

💰 **Konfigürasyon:**
• Çift başına miktar: $${this.tradeAmountPerPair}
• Maksimum pozisyon: ${this.maxConcurrentPositions}
• Zaman dilimi: ${process.env.TIMEFRAME}

🎯 **Sinyal Gereksinimleri:**
• Minimum 3/5 gösterge uyumu
• 1:1 Risk-Ödül oranı
• 30 saniyede bir gerçek zamanlı izleme

✅ **Bot şimdi aktif olarak sinyal arıyor...**`

    await this.safeSendMessage(message, {
      parse_mode: "Markdown",
      ...keyboard,
    })
  }

  setupBot() {
    // Komut işleyicileri
    this.bot.start(async (ctx) => {
      try {
        await this.sendWelcomeMessage()
      } catch (error) {
        console.error("Başlat komutunda hata:", error.message)
      }
    })

    this.bot.command("simdi", async (ctx) => {
      try {
        await this.handleAnalyzeNow(ctx)
      } catch (error) {
        console.error("Şimdi komutunda hata:", error.message)
        await ctx.reply("❌ Piyasalar analiz edilirken hata. Lütfen tekrar deneyin.")
      }
    })

    this.bot.command("durum", async (ctx) => {
      try {
        await this.handleStatus(ctx)
      } catch (error) {
        console.error("Durum komutunda hata:", error.message)
        await ctx.reply("❌ Durum alınırken hata. Lütfen tekrar deneyin.")
      }
    })

    this.bot.command("pozisyonlar", async (ctx) => {
      try {
        await this.handlePositions(ctx)
      } catch (error) {
        console.error("Pozisyonlar komutunda hata:", error.message)
        await ctx.reply("❌ Pozisyonlar alınırken hata. Lütfen tekrar deneyin.")
      }
    })

    // Callback sorgu işleyicileri
    this.bot.action("status", async (ctx) => {
      try {
        await this.handleStatus(ctx)
        await ctx.answerCbQuery()
      } catch (error) {
        console.error("Durum callback'inde hata:", error.message)
        await ctx.answerCbQuery("Hata oluştu")
      }
    })

    this.bot.action("positions", async (ctx) => {
      try {
        await this.handlePositions(ctx)
        await ctx.answerCbQuery()
      } catch (error) {
        console.error("Pozisyonlar callback'inde hata:", error.message)
        await ctx.answerCbQuery("Hata oluştu")
      }
    })

    this.bot.action("analyze_now", async (ctx) => {
      try {
        await this.handleAnalyzeNow(ctx)
        await ctx.answerCbQuery()
      } catch (error) {
        console.error("Analiz callback'inde hata:", error.message)
        await ctx.answerCbQuery("Hata oluştu")
      }
    })

    this.bot.action("pairs", async (ctx) => {
      try {
        await this.handlePairs(ctx)
        await ctx.answerCbQuery()
      } catch (error) {
        console.error("Çiftler callback'inde hata:", error.message)
        await ctx.answerCbQuery("Hata oluştu")
      }
    })

    this.bot.action("settings", async (ctx) => {
      try {
        await this.handleSettings(ctx)
        await ctx.answerCbQuery()
      } catch (error) {
        console.error("Ayarlar callback'inde hata:", error.message)
        await ctx.answerCbQuery("Hata oluştu")
      }
    })

    this.bot.action("performance", async (ctx) => {
      try {
        await this.handlePerformance(ctx)
        await ctx.answerCbQuery()
      } catch (error) {
        console.error("Performans callback'inde hata:", error.message)
        await ctx.answerCbQuery("Hata oluştu")
      }
    })

    // Pozisyon kapatma ve takip durdurma callback'leri
    this.bot.action(/kapat_(.+)/, async (ctx) => {
      try {
        const symbol = ctx.match[1]
        await this.manualClosePosition(symbol, ctx)
        await ctx.answerCbQuery()
      } catch (error) {
        console.error("Kapatma callback'inde hata:", error.message)
        await ctx.answerCbQuery("Pozisyon kapatılırken hata")
      }
    })

    this.bot.action(/takip_(.+)/, async (ctx) => {
      try {
        const symbol = ctx.match[1]
        await this.trailStopLoss(symbol, ctx)
        await ctx.answerCbQuery()
      } catch (error) {
        console.error("Takip callback'inde hata:", error.message)
        await ctx.answerCbQuery("Stop takibinde hata")
      }
    })

    this.bot.launch()
    console.log("🚀 Bot başarıyla başlatıldı!")
  }

  async startAnalysis() {
    console.log("📊 Piyasa analizi başlatılıyor...")

    // Her 30 saniyede bir analiz çalıştır
    cron.schedule("*/30 * * * * *", async () => {
      if (this.isAnalyzing) return

      try {
        this.isAnalyzing = true

        // Önce mevcut pozisyonları kontrol et
        await this.checkPositions()

        // Kullanılabilir slotumuz varsa yeni fırsatlar ara
        if (this.activePositions.size < this.maxConcurrentPositions) {
          await this.analyzeAllMarkets()
        }
      } catch (error) {
        console.error("Analiz hatası:", error.message)
        // Hata mesajlarını çok sık gönderme
        if (Math.random() < 0.1) {
          await this.safeSendMessage(`⚠️ Analiz hatası: ${error.message}`)
        }
      } finally {
        this.isAnalyzing = false
      }
    })

    // Başlatma mesajı gönder
    setTimeout(async () => {
      await this.safeSendMessage("✅ Sinyal sistemi başlatıldı ve hazır!")
      console.log("📡 Sinyal sistemi hazır")
    }, 10000)
  }

  async analyzeAllMarkets() {
    const availableSymbols = this.symbols.filter((symbol) => !this.activePositions.has(symbol))

    for (const symbol of availableSymbols) {
      if (this.activePositions.size >= this.maxConcurrentPositions) break

      try {
        await this.analyzeSingleMarket(symbol)
      } catch (error) {
        console.error(`${symbol} analiz hatası:`, error.message)
      }
    }
  }

  async analyzeSingleMarket(symbol) {
    const timeframe = process.env.TIMEFRAME

    try {
      // Piyasa verilerini al
      const candles = await this.exchange.getCandles(symbol, timeframe, 100)
      if (!candles || candles.length < 50) {
        console.log(`❌ ${symbol} için yetersiz veri`)
        return
      }

      console.log(`📊 ${symbol} analiz ediliyor...`)

      // Tüm göstergeleri hesapla
      const signals = await this.ta.analyzeAll(candles)

      // Sinyalleri say - Daha fazla sinyal için eşik 3/5'e düşürüldü
      const bullishCount = signals.filter((s) => s.signal === "BUY").length
      const bearishCount = signals.filter((s) => s.signal === "SELL").length

      console.log(`${symbol}: Boğa=${bullishCount}, Ayı=${bearishCount}`)

      if (bullishCount >= 3) {
        console.log(`🟢 ${symbol} için LONG sinyali tespit edildi`)
        await this.openPosition("BUY", symbol, candles[candles.length - 1], signals, bullishCount)
      } else if (bearishCount >= 3) {
        console.log(`🔴 ${symbol} için SHORT sinyali tespit edildi`)
        await this.openPosition("SELL", symbol, candles[candles.length - 1], signals, bearishCount)
      }
    } catch (error) {
      console.error(`${symbol} için analyzeSingleMarket hatası:`, error.message)
    }
  }

  async openPosition(side, symbol, currentCandle, signals, signalStrength) {
    if (this.activePositions.has(symbol)) return
    if (this.activePositions.size >= this.maxConcurrentPositions) return

    try {
      const currentPrice = currentCandle.close

      // ATR kullanarak 1:1 Risk-Ödül hesapla
      const atr = await this.ta.calculateATR([currentCandle], 14)
      const riskAmount = atr * 1.5 // Daha sıkı stoplar için 2'den 1.5'e düşürüldü

      const stopLoss = side === "BUY" ? currentPrice - riskAmount : currentPrice + riskAmount
      const takeProfit = side === "BUY" ? currentPrice + riskAmount : currentPrice - riskAmount

      // Kısmi seviyeleri hesapla
      const partialTP1 = side === "BUY" ? currentPrice + riskAmount * 0.5 : currentPrice - riskAmount * 0.5
      const partialTP2 = side === "BUY" ? currentPrice + riskAmount * 0.75 : currentPrice - riskAmount * 0.75

      // Pozisyon nesnesi oluştur
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

      console.log(`✅ Pozisyon açıldı: ${side} ${symbol} ${currentPrice}'da`)

      // Telegram'a sinyal gönder
      await this.sendTradingSignal(position, signals, signalStrength)

      this.pairsManager.recordTrade(symbol, side, currentPrice)
    } catch (error) {
      console.error(`${symbol} için pozisyon açma hatası:`, error.message)
    }
  }

  async sendTradingSignal(position, signals, signalStrength) {
    try {
      const { symbol, side, entryPrice, stopLoss, takeProfit, partialTP1, partialTP2, amount } = position

      const direction = side === "BUY" ? "📈 LONG" : "📉 SHORT"
      const emoji = side === "BUY" ? "🟢" : "🔴"
      const arrow = side === "BUY" ? "⬆️" : "⬇️"

      // Risk metriklerini hesapla
      const riskPercent = Math.abs((entryPrice - stopLoss) / entryPrice) * 100
      const rewardPercent = Math.abs((takeProfit - entryPrice) / entryPrice) * 100

      const signalDetails = signals
        .map((s) => `${this.getIndicatorEmoji(s.indicator)} ${s.indicator}: ${s.signal}`)
        .join("\n")

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(`${symbol} Kapat`, `kapat_${symbol}`),
          Markup.button.callback(`SL Takip Et`, `takip_${symbol}`),
        ],
        [
          Markup.button.callback("📊 Tüm Pozisyonlar", "positions"),
          Markup.button.callback("📈 Şimdi Analiz Et", "analyze_now"),
        ],
      ])

      const message = `🚨 ${emoji} **YENİ SİNYAL ALARMI** ${emoji}

${arrow} **${symbol} ${direction}**
⚡ **Sinyal Gücü: ${signalStrength}/5** ${this.getStrengthEmoji(signalStrength)}

💰 **GİRİŞ:** $${entryPrice.toFixed(4)}
🎯 **KAR AL:** $${takeProfit.toFixed(4)}
🛑 **ZARAR DURDUR:** $${stopLoss.toFixed(4)}

📊 **KISMİ HEDEFLER:**
🎯 TP1 (%50): $${partialTP1.toFixed(4)}
🎯 TP2 (%75): $${partialTP2.toFixed(4)}

⚖️ **RİSK YÖNETİMİ:**
💵 Pozisyon: $${amount}
📊 Risk: %${riskPercent.toFixed(2)}
📈 Ödül: %${rewardPercent.toFixed(2)}
⚖️ R:R: 1:${(rewardPercent / riskPercent).toFixed(1)}

🔍 **TEKNİK ANALİZ:**
${signalDetails}

⏰ **Zaman:** ${new Date().toLocaleString("tr-TR")}
📊 **Aktif:** ${this.activePositions.size}/${this.maxConcurrentPositions}

${this.getTradingAdvice(side, signalStrength)}`

      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } catch (error) {
      console.error("Trading sinyali gönderme hatası:", error.message)
    }
  }

  async checkPositions() {
    if (this.activePositions.size === 0) return

    const positionsToClose = []

    for (const [symbol, position] of this.activePositions) {
      try {
        const currentPrice = await this.exchange.getCurrentPrice(symbol)
        if (!currentPrice) continue

        // PnL hesapla
        const entryPrice = position.entryPrice
        const side = position.side

        let pnlPercent
        if (side === "BUY") {
          pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100
        } else {
          pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100
        }

        position.pnl = pnlPercent

        // Uyarıları kontrol et
        await this.checkPositionAlerts(symbol, position, currentPrice)

        // SL veya TP'nin vurulup vurulmadığını kontrol et
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
        console.error(`${symbol} pozisyon kontrolü hatası:`, error.message)
      }
    }

    // Pozisyonları kapat
    for (const closeData of positionsToClose) {
      await this.closePosition(closeData.symbol, closeData.reason, closeData.exitPrice)
    }
  }

  async checkPositionAlerts(symbol, position, currentPrice) {
    try {
      const { side, entryPrice, stopLoss, takeProfit, lastAlertPrice } = position

      // Fiyat hareketi uyarıları (her %1 hareket)
      const priceMovement = Math.abs((currentPrice - lastAlertPrice) / lastAlertPrice) * 100
      if (priceMovement >= 1.0) {
        position.lastAlertPrice = currentPrice
        await this.sendPriceUpdateAlert(symbol, position, currentPrice)
      }

      // Stop Loss yakınlık uyarıları
      const slDistance = Math.abs(currentPrice - stopLoss) / Math.abs(entryPrice - stopLoss)
      if (slDistance < 0.3 && position.slWarningsSent < 1) {
        position.slWarningsSent++
        await this.sendStopLossWarning(symbol, position, currentPrice)
      }
    } catch (error) {
      console.error(`${symbol} pozisyon uyarıları kontrolü hatası:`, error.message)
    }
  }

  async sendPartialTPAlert(symbol, level, price) {
    try {
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(`${symbol} Kapat`, `kapat_${symbol}`),
          Markup.button.callback(`SL Takip Et`, `takip_${symbol}`),
        ],
      ])

      const message = `🎉 **${level} VURULDU: ${symbol}**

✅ **Kısmi Kar Al hedefine ulaşıldı!**
💰 **Fiyat:** $${price.toFixed(4)}
🎯 **Seviye:** ${level} (${level === "TP1" ? "%50" : "%75"} hedef)

💡 **SONRAKİ ADIMLAR:**
• ${level === "TP1" ? "%25-50" : "%50-75"} kar almayı düşünün
• Stop loss'u başabaşa taşıyın
• Kalan pozisyonun devam etmesine izin verin

⏰ **Zaman:** ${new Date().toLocaleTimeString("tr-TR")}`

      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } catch (error) {
      console.error("Kısmi TP uyarısı gönderme hatası:", error.message)
    }
  }

  async sendPriceUpdateAlert(symbol, position, currentPrice) {
    try {
      const pnlPercent = position.pnl
      const pnlAmount = (position.amount * pnlPercent) / 100
      const emoji = pnlPercent > 0 ? "📈" : "📉"
      const color = pnlPercent > 0 ? "🟢" : "🔴"

      const message = `${emoji} **FİYAT GÜNCELLEMESİ: ${symbol}**

${color} **Güncel:** $${currentPrice.toFixed(4)}
📊 **Giriş:** $${position.entryPrice.toFixed(4)}
📈 **PnL:** %${pnlPercent.toFixed(2)} (${pnlAmount > 0 ? "+" : ""}$${pnlAmount.toFixed(2)})

🎯 **TP'ye Mesafe:** $${Math.abs(currentPrice - position.takeProfit).toFixed(4)}
🛑 **SL'ye Mesafe:** $${Math.abs(currentPrice - position.stopLoss).toFixed(4)}
⏰ **Süre:** ${this.formatDuration(Date.now() - position.timestamp)}`

      await this.safeSendMessage(message)
    } catch (error) {
      console.error("Fiyat güncelleme uyarısı gönderme hatası:", error.message)
    }
  }

  async sendStopLossWarning(symbol, position, currentPrice) {
    try {
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(`${symbol} Kapat`, `kapat_${symbol}`),
          Markup.button.callback(`SL Takip Et`, `takip_${symbol}`),
        ],
      ])

      const message = `⚠️ **STOP LOSS UYARISI: ${symbol}**

🚨 **Fiyat Stop Loss'a yaklaşıyor!**
📊 **Güncel:** $${currentPrice.toFixed(4)}
🛑 **Stop Loss:** $${position.stopLoss.toFixed(4)}
📉 **Mesafe:** $${Math.abs(currentPrice - position.stopLoss).toFixed(4)}

💡 **DÜŞÜNÜN:**
• Trend zayıflıyorsa manuel çıkış
• Karda ise takip eden stop
• Yakında güçlü destek varsa bekleyin`

      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } catch (error) {
      console.error("Stop loss uyarısı gönderme hatası:", error.message)
    }
  }

  async closePosition(symbol, reason, exitPrice) {
    try {
      const pos = this.activePositions.get(symbol)
      if (!pos) return

      const pnlPercent = pos.pnl
      const pnlAmount = (pos.amount * pnlPercent) / 100
      const duration = this.formatDuration(Date.now() - pos.timestamp)

      const isProfit = pnlPercent > 0
      const emoji = reason === "TAKE_PROFIT" ? "✅" : reason === "STOP_LOSS" ? "❌" : "🔄"
      const color = isProfit ? "🟢" : "🔴"

      const reasonText = {
        TAKE_PROFIT: "KAR AL",
        STOP_LOSS: "ZARAR DURDUR",
        MANUAL_CLOSE: "MANUEL KAPAMA",
      }

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("📊 Tüm Pozisyonlar", "positions"),
          Markup.button.callback("📈 Şimdi Analiz Et", "analyze_now"),
        ],
        [Markup.button.callback("📋 Performans", "performance")],
      ])

      const message = `${emoji} **POZİSYON KAPATILDI: ${symbol}**

${color} **SONUÇ:** ${reasonText[reason] || reason}
📊 **Yön:** ${pos.side === "BUY" ? "LONG" : "SHORT"}
💰 **Giriş:** $${pos.entryPrice.toFixed(4)}
🚪 **Çıkış:** $${exitPrice.toFixed(4)}
📈 **PnL:** %${pnlPercent.toFixed(2)} (${pnlAmount > 0 ? "+" : ""}$${pnlAmount.toFixed(2)})
⏰ **Süre:** ${duration}

📊 **PORTFÖY DURUMU:**
• **Kalan Pozisyonlar:** ${this.activePositions.size - 1}/${this.maxConcurrentPositions}
• **Kullanılabilir Slot:** ${this.maxConcurrentPositions - this.activePositions.size + 1}

${this.getPostTradeAdvice(reason, pnlPercent)}`

      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })

      console.log(`📊 Pozisyon kapatıldı: ${symbol} ${reason} PnL: %${pnlPercent.toFixed(2)}`)

      // İstatistikleri güncelle
      this.pairsManager.recordClose(symbol, reason === "TAKE_PROFIT", pnlPercent)

      // Pozisyonu kaldır
      this.activePositions.delete(symbol)
    } catch (error) {
      console.error(`${symbol} pozisyon kapatma hatası:`, error.message)
    }
  }

  // İşleyici metodları
  async handleAnalyzeNow(ctx) {
    try {
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Yenile", "analyze_now"), Markup.button.callback("📊 Durum", "status")],
      ])

      let message = "📊 **GERÇEK ZAMANLI PİYASA ANALİZİ**\n\n"

      for (const symbol of this.symbols) {
        try {
          const candles = await this.exchange.getCandles(symbol, process.env.TIMEFRAME, 50)
          if (!candles || candles.length < 20) continue

          const currentPrice = candles[candles.length - 1].close
          const signals = await this.ta.analyzeAll(candles)

          const bullishCount = signals.filter((s) => s.signal === "BUY").length
          const bearishCount = signals.filter((s) => s.signal === "SELL").length

          let status = "⚪ NÖTR"
          if (bullishCount >= 3) status = "🟢 YUKARI YÖNLÜ"
          else if (bearishCount >= 3) status = "🔴 AŞAĞI YÖNLÜ"

          const positionStatus = this.activePositions.has(symbol) ? "📈 AKTİF" : "⏳ BEKLİYOR"

          message += `💎 **${symbol}** ${positionStatus}\n`
          message += `💰 Fiyat: $${currentPrice.toFixed(4)}\n`
          message += `📊 Sinyal: ${status} (${Math.max(bullishCount, bearishCount)}/5)\n`
          message += `🔍 Boğa: ${bullishCount} | Ayı: ${bearishCount}\n\n`
        } catch (error) {
          message += `💎 **${symbol}**: ❌ Analiz Hatası\n\n`
        }
      }

      message += `⏰ **Güncellendi:** ${new Date().toLocaleString("tr-TR")}`

      await this.safeEditMessage(ctx, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } catch (error) {
      console.error("handleAnalyzeNow hatası:", error.message)
    }
  }

  async handleStatus(ctx) {
    try {
      const activeCount = this.activePositions.size
      const availableSlots = this.maxConcurrentPositions - activeCount

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Yenile", "status"), Markup.button.callback("💼 Pozisyonlar", "positions")],
        [Markup.button.callback("📈 Şimdi Analiz Et", "analyze_now")],
      ])

      const message = `📊 **BOT DURUMU**

🔄 **Aktif Pozisyonlar:** ${activeCount}/${this.maxConcurrentPositions}
💹 **Kullanılabilir Slot:** ${availableSlots}
📈 **İzlenen:** ${this.symbols.length} çift
⏰ **Zaman Dilimi:** ${process.env.TIMEFRAME}

📊 **ÇİFT DURUMU:**
${this.symbols.map((s) => `${this.activePositions.has(s) ? "🟢" : "⚪"} ${s}`).join("\n")}

⏰ **Güncellendi:** ${new Date().toLocaleString("tr-TR")}`

      await this.safeEditMessage(ctx, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } catch (error) {
      console.error("handleStatus hatası:", error.message)
    }
  }

  async handlePositions(ctx) {
    try {
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Yenile", "positions"), Markup.button.callback("📊 Durum", "status")],
        ...Array.from(this.activePositions.keys()).map((symbol) => [
          Markup.button.callback(`${symbol} Kapat`, `kapat_${symbol}`),
          Markup.button.callback(`${symbol} Takip`, `takip_${symbol}`),
        ]),
      ])

      if (this.activePositions.size === 0) {
        const message = "📭 **Aktif Pozisyon Yok**\n\n⏳ Trading sinyalleri bekleniyor..."

        await this.safeEditMessage(ctx, message, {
          parse_mode: "Markdown",
          ...keyboard,
        })
        return
      }

      let message = "💼 **AKTİF POZİSYONLAR**\n\n"

      for (const [symbol, pos] of this.activePositions) {
        const pnlColor = pos.pnl > 0 ? "🟢" : "🔴"
        const pnlAmount = (pos.amount * pos.pnl) / 100

        message += `💎 **${symbol}** (${pos.side === "BUY" ? "LONG" : "SHORT"})\n`
        message += `💰 Giriş: $${pos.entryPrice.toFixed(4)}\n`
        message += `🎯 TP: $${pos.takeProfit.toFixed(4)} | 🛑 SL: $${pos.stopLoss.toFixed(4)}\n`
        message += `${pnlColor} PnL: %${pos.pnl.toFixed(2)} ($${pnlAmount.toFixed(2)})\n`
        message += `⏰ Süre: ${this.formatDuration(Date.now() - pos.timestamp)}\n\n`
      }

      message += `⏰ **Güncellendi:** ${new Date().toLocaleString("tr-TR")}`

      await this.safeEditMessage(ctx, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } catch (error) {
      console.error("handlePositions hatası:", error.message)
    }
  }

  async handlePairs(ctx) {
    try {
      const pairStats = this.pairsManager.getAllPairStats()

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Yenile", "pairs"), Markup.button.callback("📊 Performans", "performance")],
      ])

      let message = "📈 **ÇİFT PERFORMANSI (24s)**\n\n"

      for (const symbol of this.symbols) {
        const stats = pairStats[symbol] || { trades: 0, winRate: 0, totalPnl: 0 }
        const status = this.activePositions.has(symbol) ? "🟢 AKTİF" : "⚪ BEKLİYOR"

        message += `💎 **${symbol}** ${status}\n`
        message += `📊 İşlemler: ${stats.trades} | Kazanma Oranı: %${stats.winRate.toFixed(1)}\n`
        message += `💰 PnL: ${stats.totalPnl > 0 ? "+" : ""}%${stats.totalPnl.toFixed(2)}\n\n`
      }

      message += `⏰ **Güncellendi:** ${new Date().toLocaleString("tr-TR")}`

      await this.safeEditMessage(ctx, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } catch (error) {
      console.error("handlePairs hatası:", error.message)
    }
  }

  async handleSettings(ctx) {
    try {
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("📊 Durum", "status"), Markup.button.callback("💼 Pozisyonlar", "positions")],
      ])

      const message = `⚙️ **BOT AYARLARI**

📊 **Konfigürasyon:**
• Semboller: ${this.symbols.join(", ")}
• Zaman dilimi: ${process.env.TIMEFRAME}
• Çift başına miktar: $${this.tradeAmountPerPair}
• Maksimum pozisyon: ${this.maxConcurrentPositions}

🎯 **Sinyal Ayarları:**
• Minimum göstergeler: 3/5
• Risk-Ödül: 1:1
• Analiz sıklığı: 30 saniye

🔔 **Uyarı Ayarları:**
• Fiyat güncellemeleri: Her %1 hareket
• SL uyarıları: %30 yakınlık
• TP uyarıları: %50 ve %75 hedeflerde

⏰ **Güncellendi:** ${new Date().toLocaleString("tr-TR")}`

      await this.safeEditMessage(ctx, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } catch (error) {
      console.error("handleSettings hatası:", error.message)
    }
  }

  async handlePerformance(ctx) {
    try {
      const report = this.pairsManager.getDailyReport()

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Yenile", "performance"), Markup.button.callback("📋 Çiftler", "pairs")],
      ])

      const message = `📊 **GÜNLÜK PERFORMANS**

📈 **Genel Bakış:**
• Toplam İşlem: ${report.totalTrades}
• Kazanma Oranı: %${report.avgWinRate.toFixed(1)}
• Toplam PnL: ${report.totalPnL > 0 ? "+" : ""}%${report.totalPnL.toFixed(2)}

🏆 **En İyi Performans:** ${report.bestPair || "Yok"}
📉 **Dikkat Gereken:** ${report.worstPair || "Yok"}

💡 **Bugünün Odağı:**
• ${report.bestPair || "en iyi performansları"} izleyin
• ${report.worstPair || "düşük performansları"} gözden geçirin
• Risk disiplinini koruyun

⏰ **Güncellendi:** ${new Date().toLocaleString("tr-TR")}`

      await this.safeEditMessage(ctx, message, {
        parse_mode: "Markdown",
        ...keyboard,
      })
    } catch (error) {
      console.error("handlePerformance hatası:", error.message)
    }
  }

  async manualClosePosition(symbol, ctx) {
    try {
      const currentPrice = await this.exchange.getCurrentPrice(symbol)
      if (!currentPrice) {
        const message = `❌ ${symbol} için güncel fiyat alınamadı`
        await this.safeEditMessage(ctx, message)
        return
      }

      await this.closePosition(symbol, "MANUAL_CLOSE", currentPrice)

      const message = `✅ ${symbol} pozisyonu $${currentPrice.toFixed(4)}'da manuel olarak kapatıldı`
      await this.safeEditMessage(ctx, message)
    } catch (error) {
      console.error(`${symbol} için manualClosePosition hatası:`, error.message)
      const message = `❌ Pozisyon kapatma hatası: ${error.message}`
      await this.safeEditMessage(ctx, message)
    }
  }

  async trailStopLoss(symbol, ctx) {
    try {
      const position = this.activePositions.get(symbol)
      if (!position) return

      const currentPrice = await this.exchange.getCurrentPrice(symbol)
      if (!currentPrice) {
        const message = `❌ ${symbol} için güncel fiyat alınamadı`
        await this.safeEditMessage(ctx, message)
        return
      }

      if (position.pnl > 0) {
        position.stopLoss = position.entryPrice
        const message = `✅ ${symbol} için stop loss başabaşa taşındı`
        await this.safeEditMessage(ctx, message)

        await this.safeSendMessage(`🔄 **STOP LOSS GÜNCELLENDİ: ${symbol}**

🛑 **Yeni Stop Loss:** $${position.stopLoss.toFixed(4)} (Başabaş)
📊 **Güncel Fiyat:** $${currentPrice.toFixed(4)}
📈 **Korunan Kar:** Risksiz işlem`)
      } else {
        const message = `⚠️ ${symbol} pozisyonu henüz karda değil`
        await this.safeEditMessage(ctx, message)
      }
    } catch (error) {
      console.error(`${symbol} için trailStopLoss hatası:`, error.message)
      const message = `❌ Stop takip hatası: ${error.message}`
      await this.safeEditMessage(ctx, message)
    }
  }

  // Yardımcı metodlar
  getTradingAdvice(side, signalStrength) {
    const advice = []

    if (signalStrength >= 4) {
      advice.push("🔥 **YÜKSEK GÜVENİLİRLİK SİNYALİ**")
    } else {
      advice.push("⚠️ **ORTA SEVİYE SİNYAL**")
    }

    if (side === "BUY") {
      advice.push("📈 **LONG STRATEJİSİ:**")
      advice.push("• Giriş bölgesine düşüşte girin")
      advice.push("• Hacim onayını izleyin")
    } else {
      advice.push("📉 **SHORT STRATEJİSİ:**")
      advice.push("• Giriş bölgesine yükselişte girin")
      advice.push("• Kırılım onayını izleyin")
    }

    return advice.join("\n")
  }

  getPostTradeAdvice(reason, pnl) {
    if (reason === "TAKE_PROFIT") {
      return "🎉 **BAŞARILI İŞLEM!**\nStrateji iyi çalışıyor"
    } else {
      return "📚 **ÖĞRENME FIRSATI**\nGiriş zamanlamasını gözden geçirin"
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
    return hours > 0 ? `${hours}s ${minutes % 60}d` : `${minutes}d`
  }

  async sendMessage(text) {
    await this.safeSendMessage(text, {
      parse_mode: "Markdown",
    })
  }
}

// Botu başlat
const bot = new CryptoTradingBot()

// Zarif kapatma
process.once("SIGINT", () => {
  console.log("🛑 SIGINT alındı, zarif bir şekilde kapatılıyor...")
  bot.bot.stop("SIGINT")
})

process.once("SIGTERM", () => {
  console.log("🛑 SIGTERM alındı, zarif bir şekilde kapatılıyor...")
  bot.bot.stop("SIGTERM")
})

console.log("🚀 Bot tüm metodlarla Türkçe olarak başlatıldı!")
