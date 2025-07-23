import { BinanceService } from "../services/BinanceService.js"
import { TechnicalAnalysis } from "../analysis/TechnicalAnalysis.js"
import { NewsAnalysis } from "../analysis/NewsAnalysis.js"
import { RiskManager } from "../utils/RiskManager.js"
import { PatternRecognition } from "../analysis/PatternRecognition.js"
import { Logger } from "../utils/Logger.js"

export class TradingBot {
  constructor() {
    this.binance = new BinanceService()
    this.technicalAnalysis = new TechnicalAnalysis()
    this.newsAnalysis = new NewsAnalysis()
    this.riskManager = new RiskManager()
    this.patternRecognition = new PatternRecognition()
    this.logger = new Logger()

    this.symbol = "INJUSDT"
    this.interval = "15m"
    this.statistics = {
      totalSignals: 0,
      successfulSignals: 0,
      failedSignals: 0,
      weeklyStats: [],
      startTime: new Date(),
    }
  }

  async performFullAnalysis() {
    try {
      this.logger.info("🔍 Tam analiz başlatılıyor...")

      // 1. Market verilerini al
      const marketData = await this.binance.getMarketData(this.symbol, this.interval)

      // 2. 15 teknik indikatör analizi
      const technicalSignals = await this.technicalAnalysis.analyze(marketData)

      // 3. Haber sentiment analizi
      const newsSentiment = await this.newsAnalysis.analyzeSentiment("INJ cryptocurrency")

      // 4. Korku/Açgözlülük endeksi
      const fearGreedIndex = await this.getFearGreedIndex()

      // 5. Pattern tanıma
      const patterns = await this.patternRecognition.detectPatterns(marketData)

      // 6. Volatilite analizi
      const volatilityAnalysis = this.analyzeVolatility(marketData)

      // 7. Risk değerlendirmesi
      const riskAssessment = this.riskManager.assessRisk(marketData, technicalSignals)

      // 8. Sinyal üretimi
      const signal = this.generateSignal(technicalSignals, newsSentiment, fearGreedIndex, patterns, riskAssessment)

      return {
        currentPrice: marketData.currentPrice,
        priceChange24h: marketData.priceChange24h,
        volume: marketData.volume,
        indicators: technicalSignals,
        newsSentiment: newsSentiment.score || 0,
        fearGreedIndex: fearGreedIndex.value || 50,
        patterns: patterns || [],
        volatilityLevel: volatilityAnalysis.level,
        volatilityAlert: volatilityAnalysis.alert,
        volatilityReasons: volatilityAnalysis.reasons,
        priceChange: volatilityAnalysis.priceChange || 0,
        newsImpact: newsSentiment.classification || "neutral",
        riskLevel: riskAssessment.level,
        signal: signal.action,
        confidence: signal.confidence,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        overallSignal: signal.overall,
      }
    } catch (error) {
      this.logger.error("Analiz hatası:", error)

      // Hata durumunda basit analiz döndür
      try {
        const marketData = await this.binance.getMarketData(this.symbol, this.interval)
        return {
          currentPrice: marketData.currentPrice,
          priceChange24h: marketData.priceChange24h,
          volume: marketData.volume,
          indicators: [
            {
              name: "Price",
              value: marketData.currentPrice?.toFixed(4) || "0.0000",
              signal: "HOLD",
              weight: 1,
            },
          ],
          newsSentiment: 0,
          fearGreedIndex: 50,
          patterns: [],
          volatilityLevel: "UNKNOWN",
          volatilityAlert: false,
          volatilityReasons: ["Analiz hatası"],
          priceChange: 0,
          newsImpact: "neutral",
          riskLevel: "HIGH",
          signal: "HOLD",
          confidence: 0,
          entryPrice: marketData.currentPrice?.toFixed(4) || "0.0000",
          stopLoss: marketData.currentPrice?.toFixed(4) || "0.0000",
          takeProfit: marketData.currentPrice?.toFixed(4) || "0.0000",
          overallSignal: "ERROR",
        }
      } catch (fallbackError) {
        this.logger.error("Fallback analiz de başarısız:", fallbackError)
        throw error
      }
    }
  }

  generateSignal(technicalSignals, newsSentiment, fearGreedIndex, patterns, riskAssessment) {
    let buyScore = 0
    let sellScore = 0
    let confidence = 0

    // Teknik indikatör skorları
    technicalSignals.forEach((indicator) => {
      const weight = indicator.weight || 1
      if (indicator.signal === "BUY") {
        buyScore += weight
      } else if (indicator.signal === "SELL") {
        sellScore += weight
      }
    })

    // Haber sentiment etkisi
    const sentimentScore = newsSentiment.score || 0
    if (sentimentScore > 0.3) buyScore += 2
    if (sentimentScore < -0.3) sellScore += 2

    // Korku/Açgözlülük endeksi etkisi
    const fearGreedValue = fearGreedIndex.value || 50
    if (fearGreedValue < 25) buyScore += 1 // Aşırı korku - alım fırsatı
    if (fearGreedValue > 75) sellScore += 1 // Aşırı açgözlülük - satış sinyali

    // Pattern etkisi
    if (patterns && patterns.length > 0) {
      patterns.forEach((pattern) => {
        if (pattern.type === "bullish") buyScore += pattern.strength || 1
        if (pattern.type === "bearish") sellScore += pattern.strength || 1
      })
    }

    // Risk değerlendirmesi
    if (riskAssessment.level === "HIGH") {
      buyScore *= 0.5
      sellScore *= 0.5
    }

    // Sinyal belirleme
    let action = "HOLD"
    let overall = "NEUTRAL"

    if (buyScore > sellScore && buyScore >= 8) {
      action = "BUY"
      overall = "BULLISH"
      confidence = Math.min(95, (buyScore / (buyScore + sellScore)) * 100)
    } else if (sellScore > buyScore && sellScore >= 8) {
      action = "SELL"
      overall = "BEARISH"
      confidence = Math.min(95, (sellScore / (buyScore + sellScore)) * 100)
    }

    // Fiyat hesaplamaları (Jim Simons tarzı risk yönetimi)
    const currentPrice = technicalSignals.find((t) => t.name === "Price")?.value || 0
    const atr = technicalSignals.find((t) => t.name === "ATR")?.value || Number.parseFloat(currentPrice) * 0.02

    let entryPrice, stopLoss, takeProfit

    if (action === "BUY") {
      entryPrice = Number.parseFloat(currentPrice) * 1.001 // Hafif yukarıdan giriş
      stopLoss = Number.parseFloat(currentPrice) - Number.parseFloat(atr) * 2
      takeProfit = Number.parseFloat(currentPrice) + Number.parseFloat(atr) * 3
    } else if (action === "SELL") {
      entryPrice = Number.parseFloat(currentPrice) * 0.999 // Hafif aşağıdan giriş
      stopLoss = Number.parseFloat(currentPrice) + Number.parseFloat(atr) * 2
      takeProfit = Number.parseFloat(currentPrice) - Number.parseFloat(atr) * 3
    } else {
      entryPrice = Number.parseFloat(currentPrice)
      stopLoss = Number.parseFloat(currentPrice)
      takeProfit = Number.parseFloat(currentPrice)
    }

    return {
      action,
      confidence: Math.round(confidence),
      entryPrice: entryPrice?.toFixed(4) || currentPrice,
      stopLoss: stopLoss?.toFixed(4) || currentPrice,
      takeProfit: takeProfit?.toFixed(4) || currentPrice,
      overall,
      buyScore,
      sellScore,
    }
  }

  analyzeVolatility(marketData) {
    const prices = marketData.closes || []
    if (prices.length < 20)
      return {
        level: "LOW",
        alert: false,
        reasons: ["Yetersiz veri"],
        priceChange: 0,
      }

    // Volatilite hesaplaması
    const returns = []
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    const volatility = Math.sqrt(variance) * 100

    // Son fiyat değişimi
    const currentPrice = prices[prices.length - 1]
    const previousPrice = prices[prices.length - 2]
    const priceChange = (((currentPrice - previousPrice) / previousPrice) * 100).toFixed(2)

    let level = "LOW"
    let alert = false
    const reasons = []

    if (volatility > 5) {
      level = "HIGH"
      alert = true
      reasons.push("📊 Yüksek fiyat volatilitesi tespit edildi")
    } else if (volatility > 3) {
      level = "MEDIUM"
      reasons.push("📊 Orta seviye volatilite")
    }

    // Volume analizi
    const volumes = marketData.volumes || []
    if (volumes.length > 1) {
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length
      const currentVolume = marketData.volume || 0

      if (currentVolume > avgVolume * 2) {
        alert = true
        reasons.push("📈 Anormal yüksek işlem hacmi")
      }
    }

    return {
      level,
      alert,
      reasons,
      volatility: volatility.toFixed(2),
      priceChange: Number.parseFloat(priceChange),
    }
  }

  async getFearGreedIndex() {
    try {
      const response = await fetch(process.env.FEAR_GREED_API)
      const data = await response.json()
      return {
        value: Number.parseInt(data.data[0].value),
        classification: data.data[0].value_classification,
      }
    } catch (error) {
      this.logger.error("Korku/Açgözlülük endeksi alınamadı:", error)
      return { value: 50, classification: "Neutral" }
    }
  }

  async getStatistics() {
    const uptime = Math.floor((new Date() - this.statistics.startTime) / 1000 / 60) // dakika
    return {
      successRate:
        this.statistics.totalSignals > 0
          ? Math.round((this.statistics.successfulSignals / this.statistics.totalSignals) * 100)
          : 0,
      totalSignals: this.statistics.totalSignals,
      successfulSignals: this.statistics.successfulSignals,
      failedSignals: this.statistics.failedSignals,
      averageProfit: 2.5, // Hesaplanacak
      weeklyStats: this.statistics.weeklyStats,
      uptime: `${uptime} dakika`,
    }
  }
}
