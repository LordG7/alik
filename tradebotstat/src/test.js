import { TradingBot } from "./bot/TradingBot.js"
import { BinanceService } from "./services/BinanceService.js"
import { Logger } from "./utils/Logger.js"
import dotenv from "dotenv"

dotenv.config()

const logger = new Logger()

async function testBinanceConnection() {
  try {
    logger.info("🔗 Binance bağlantısı test ediliyor...")

    const binanceService = new BinanceService()
    const isConnected = await binanceService.testConnection()

    if (isConnected) {
      logger.info("✅ Binance bağlantısı başarılı!")

      // Market data testi
      logger.info("📊 Market data testi...")
      const marketData = await binanceService.getMarketData("INJUSDT", "15m", 20)

      console.log("\n📊 MARKET DATA:")
      console.log("===============")
      console.log(`💰 Güncel Fiyat: $${marketData.currentPrice}`)
      console.log(`📈 24s Değişim: %${marketData.priceChange24h}`)
      console.log(`📊 Volume: ${marketData.volume}`)
      console.log(`📈 24s Yüksek: $${marketData.high24h}`)
      console.log(`📉 24s Düşük: $${marketData.low24h}`)
      console.log(`📋 Kline Sayısı: ${marketData.closes.length}`)

      return true
    } else {
      logger.error("❌ Binance bağlantısı başarısız!")
      return false
    }
  } catch (error) {
    logger.error("❌ Binance test hatası:", error)
    return false
  }
}

async function testBot() {
  try {
    logger.info("🧪 Bot test başlatılıyor...")

    // Önce Binance bağlantısını test et
    const binanceOk = await testBinanceConnection()

    if (!binanceOk) {
      logger.warn("⚠️ Binance bağlantısı başarısız, mock data ile devam ediliyor...")
      process.env.NODE_ENV = "development"
    }

    const bot = new TradingBot()

    logger.info("🔍 Tam analiz başlatılıyor...")
    const analysis = await bot.performFullAnalysis()

    console.log("\n📊 ANALİZ SONUÇLARI:")
    console.log("===================")
    console.log(`💰 Güncel Fiyat: $${analysis.currentPrice}`)
    console.log(`📈 24s Değişim: %${analysis.priceChange24h}`)
    console.log(`📊 Volume: ${analysis.volume}`)
    console.log(`🎯 Sinyal: ${analysis.signal}`)
    console.log(`📊 Güven: %${analysis.confidence}`)
    console.log(`💰 Giriş: $${analysis.entryPrice}`)
    console.log(`🛑 Stop Loss: $${analysis.stopLoss}`)
    console.log(`🎯 Take Profit: $${analysis.takeProfit}`)

    console.log("\n🔍 TEKNİK İNDİKATÖRLER:")
    console.log("======================")
    analysis.indicators.forEach((ind, index) => {
      if (index < 10) {
        // İlk 10 indikatörü göster
        const emoji = ind.signal === "BUY" ? "🟢" : ind.signal === "SELL" ? "🔴" : "🟡"
        console.log(`${emoji} ${ind.name}: ${ind.value} (${ind.signal})`)
      }
    })

    console.log(`\n📰 Haber Sentiment: ${analysis.newsSentiment} (${analysis.newsImpact})`)
    console.log(`😱 Korku/Açgözlülük: ${analysis.fearGreedIndex}`)
    console.log(`⚠️ Risk Seviyesi: ${analysis.riskLevel}`)
    console.log(`📊 Volatilite: ${analysis.volatilityLevel}`)

    if (analysis.patterns && analysis.patterns.length > 0) {
      console.log("\n🔍 TESPİT EDİLEN PATTERNLER:")
      console.log("============================")
      analysis.patterns.forEach((pattern) => {
        console.log(`• ${pattern.name}: ${pattern.description} (%${pattern.confidence})`)
      })
    }

    // İstatistikler
    const stats = await bot.getStatistics()
    console.log("\n📊 BOT İSTATİSTİKLERİ:")
    console.log("======================")
    console.log(`🎯 Başarı Oranı: %${stats.successRate}`)
    console.log(`📈 Toplam Sinyal: ${stats.totalSignals}`)
    console.log(`⏰ Çalışma Süresi: ${stats.uptime}`)

    logger.info("✅ Test başarıyla tamamlandı!")

    // Telegram test önerisi
    console.log("\n🤖 TELEGRAM BOT TESTİ:")
    console.log("======================")
    console.log("Telegram botunuza şu komutları göndererek test edebilirsiniz:")
    console.log("• /start - Bot bilgileri")
    console.log("• /status - Bot durumu")
    console.log("• /analysis - Anlık analiz")
    console.log("• /stats - İstatistikler")

    return true
  } catch (error) {
    logger.error("❌ Test hatası:", error)
    console.error("\n🔧 HATA AYIKLAMA:")
    console.error("==================")
    console.error("1. .env dosyasındaki API anahtarlarını kontrol edin")
    console.error("2. Binance API anahtarlarının doğru olduğundan emin olun")
    console.error("3. İnternet bağlantınızı kontrol edin")
    console.error("4. Binance API'sinin erişilebilir olduğunu kontrol edin")

    return false
  }
}

// Test çalıştır
testBot()
  .then((success) => {
    if (success) {
      console.log("\n🎉 Tüm testler başarılı! Bot çalışmaya hazır.")
      process.exit(0)
    } else {
      console.log("\n❌ Test başarısız! Lütfen hataları düzeltin.")
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error("❌ Test çalıştırma hatası:", error)
    process.exit(1)
  })
