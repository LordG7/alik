import { TradingBot } from "./bot/TradingBot.js"
import { Logger } from "./utils/Logger.js"
import dotenv from "dotenv"

dotenv.config()

const logger = new Logger()

async function testBot() {
  try {
    logger.info("🧪 Bot test başlatılıyor...")

    const bot = new TradingBot()

    // Tam analiz testi
    const analysis = await bot.performFullAnalysis()

    console.log("\n📊 ANALİZ SONUÇLARI:")
    console.log("===================")
    console.log(`💰 Güncel Fiyat: $${analysis.currentPrice}`)
    console.log(`📈 24s Değişim: %${analysis.priceChange24h}`)
    console.log(`🎯 Sinyal: ${analysis.signal}`)
    console.log(`📊 Güven: %${analysis.confidence}`)
    console.log(`💰 Giriş: $${analysis.entryPrice}`)
    console.log(`🛑 Stop Loss: $${analysis.stopLoss}`)
    console.log(`🎯 Take Profit: $${analysis.takeProfit}`)

    console.log("\n🔍 TEKNİK İNDİKATÖRLER:")
    analysis.indicators.forEach((ind) => {
      const emoji = ind.signal === "BUY" ? "🟢" : ind.signal === "SELL" ? "🔴" : "🟡"
      console.log(`${emoji} ${ind.name}: ${ind.value} (${ind.signal})`)
    })

    console.log(`\n📰 Haber Sentiment: ${analysis.newsSentiment}`)
    console.log(`😱 Korku/Açgözlülük: ${analysis.fearGreedIndex}`)
    console.log(`⚠️ Risk Seviyesi: ${analysis.riskLevel}`)

    if (analysis.patterns && analysis.patterns.length > 0) {
      console.log("\n🔍 TESPİT EDİLEN PATTERNLER:")
      analysis.patterns.forEach((pattern) => {
        console.log(`• ${pattern.name}: ${pattern.description} (%${pattern.confidence})`)
      })
    }

    logger.info("✅ Test başarıyla tamamlandı")
  } catch (error) {
    logger.error("❌ Test hatası:", error)
  }
}

// Test çalıştır
testBot()
