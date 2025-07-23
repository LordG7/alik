class RiskManager {
  constructor() {
    this.maxRiskPerTrade = 0.02 // %2 maksimum risk
    this.maxDailyRisk = 0.1 // %10 maksimum günlük risk
    this.minConfidence = 85 // Minimum %85 güven
  }

  assessRisk(technicalSignal, newsSignal) {
    const riskFactors = {
      volatility: this.assessVolatilityRisk(technicalSignal.volatility),
      sentiment: this.assessSentimentRisk(newsSignal.sentimentScore),
      technical: this.assessTechnicalRisk(technicalSignal),
      market: this.assessMarketRisk(),
    }

    const totalRisk = this.calculateTotalRisk(riskFactors)

    return {
      riskLevel: totalRisk,
      riskFactors: riskFactors,
      recommendation: this.getRiskRecommendation(totalRisk),
      maxPositionSize: this.calculateMaxPositionSize(totalRisk),
      stopLossDistance: this.calculateStopLossDistance(totalRisk, technicalSignal.atr),
    }
  }

  assessVolatilityRisk(volatility) {
    if (volatility > 0.08) return 5 // Çok yüksek risk
    if (volatility > 0.05) return 4 // Yüksek risk
    if (volatility > 0.03) return 3 // Orta risk
    if (volatility > 0.02) return 2 // Düşük risk
    return 1 // Çok düşük risk
  }

  assessSentimentRisk(sentimentScore) {
    const absScore = Math.abs(sentimentScore)
    if (absScore >= 3) return 2 // Aşırı sentiment = risk
    if (absScore >= 2) return 1 // Güçlü sentiment = hafif risk
    return 0 // Nötr sentiment = risk yok
  }

  assessTechnicalRisk(technical) {
    let risk = 0

    // RSI aşırı bölgelerde risk
    if (technical.rsi > 80 || technical.rsi < 20) risk += 1

    // Yüksek volatilite riski
    if (technical.volatility > 0.05) risk += 2

    // Çelişkili sinyaller riski
    const signals = [
      technical.macdSignal,
      technical.bollingerSignal,
      technical.stochSignal,
      technical.emaSignal,
      technical.smaSignal,
    ]

    const buySignals = signals.filter((s) => s === "BUY").length
    const sellSignals = signals.filter((s) => s === "SELL").length

    // Çelişkili sinyaller varsa risk ekle
    if (buySignals > 0 && sellSignals > 0) risk += 1

    return Math.min(risk, 5)
  }

  assessMarketRisk() {
    // Piyasa saatleri, hafta sonu, tatil günleri vb. kontrolleri
    const now = new Date()
    const hour = now.getHours()

    // Gece saatleri daha riskli
    if (hour < 6 || hour > 22) return 1

    return 0
  }

  calculateTotalRisk(riskFactors) {
    const weights = {
      volatility: 0.4,
      sentiment: 0.2,
      technical: 0.3,
      market: 0.1,
    }

    let totalRisk = 0
    for (const [factor, value] of Object.entries(riskFactors)) {
      totalRisk += value * weights[factor]
    }

    return Math.min(Math.round(totalRisk), 5)
  }

  getRiskRecommendation(riskLevel) {
    switch (riskLevel) {
      case 0:
      case 1:
        return "🟢 Düşük Risk - İşlem yapılabilir"
      case 2:
        return "🟡 Orta Risk - Dikkatli işlem yapın"
      case 3:
        return "🟠 Yüksek Risk - Küçük pozisyon alın"
      case 4:
        return "🔴 Çok Yüksek Risk - İşlemden kaçının"
      case 5:
        return "⛔ Aşırı Risk - İşlem yapmayın"
      default:
        return "❓ Bilinmeyen Risk"
    }
  }

  calculateMaxPositionSize(riskLevel) {
    const baseSize = 1000 // $1000 baz pozisyon
    const riskMultiplier = Math.max(0.1, 1 - riskLevel * 0.15)
    return Math.round(baseSize * riskMultiplier)
  }

  calculateStopLossDistance(riskLevel, atr) {
    // ATR bazlı stop loss hesaplama
    const baseMultiplier = 2 // 2x ATR
    const riskMultiplier = 1 + riskLevel * 0.2 // Risk arttıkça stop loss mesafesi artar
    return atr * baseMultiplier * riskMultiplier
  }

  // Likvidasyon riskini hesapla
  calculateLiquidationRisk(entryPrice, leverage, direction, maxPrice) {
    if (direction === "LONG") {
      const liquidationPrice = entryPrice * (1 - 1 / leverage)
      const riskDistance = Math.abs(maxPrice - liquidationPrice) / entryPrice
      return {
        liquidationPrice: liquidationPrice,
        riskDistance: riskDistance,
        safetyMargin: riskDistance > 0.1 ? "Güvenli" : "Riskli",
      }
    } else {
      const liquidationPrice = entryPrice * (1 + 1 / leverage)
      const riskDistance = Math.abs(liquidationPrice - maxPrice) / entryPrice
      return {
        liquidationPrice: liquidationPrice,
        riskDistance: riskDistance,
        safetyMargin: riskDistance > 0.1 ? "Güvenli" : "Riskli",
      }
    }
  }
}

module.exports = RiskManager
