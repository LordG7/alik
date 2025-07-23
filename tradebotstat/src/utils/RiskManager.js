export class RiskManager {
  constructor() {
    this.maxRiskPerTrade = 0.02 // %2 maksimum risk
    this.maxDailyRisk = 0.06 // %6 günlük maksimum risk
    this.volatilityThreshold = 0.05 // %5 volatilite eşiği
  }

  assessRisk(marketData, technicalSignals) {
    let riskScore = 0
    const factors = []

    try {
      // 1. Volatilite riski
      const atr = technicalSignals.find((t) => t.name === "ATR")
      if (atr && atr.value) {
        const volatility = Number.parseFloat(atr.value) / marketData.currentPrice
        if (volatility > this.volatilityThreshold) {
          riskScore += 30
          factors.push("Yüksek volatilite")
        }
      }

      // 2. Spread riski
      if (marketData.spread) {
        const spreadPercent = marketData.spread / marketData.currentPrice
        if (spreadPercent > 0.001) {
          // %0.1'den fazla spread
          riskScore += 20
          factors.push("Geniş spread")
        }
      }

      // 3. Volume riski
      if (marketData.volume && marketData.avgVolume) {
        if (marketData.volume < marketData.avgVolume * 0.5) {
          riskScore += 25
          factors.push("Düşük işlem hacmi")
        }
      }

      // 4. Teknik indikatör uyumsuzluğu
      const buySignals = technicalSignals.filter((t) => t.signal === "BUY").length
      const sellSignals = technicalSignals.filter((t) => t.signal === "SELL").length
      const totalSignals = buySignals + sellSignals

      if (totalSignals > 0) {
        const consensus = Math.max(buySignals, sellSignals) / totalSignals
        if (consensus < 0.6) {
          // %60'dan az konsensüs
          riskScore += 25
          factors.push("İndikatör uyumsuzluğu")
        }
      }

      // Risk seviyesi belirleme
      let level = "LOW"
      if (riskScore > 70) level = "HIGH"
      else if (riskScore > 40) level = "MEDIUM"

      return {
        level,
        score: riskScore,
        factors,
        recommendation: this.getRiskRecommendation(level, riskScore),
      }
    } catch (error) {
      console.error("Risk değerlendirme hatası:", error)
      return {
        level: "HIGH",
        score: 100,
        factors: ["Risk değerlendirme hatası"],
        recommendation: "İşlem yapılması önerilmez.",
      }
    }
  }

  getRiskRecommendation(level, score) {
    switch (level) {
      case "HIGH":
        return "İşlem yapılması önerilmez. Piyasa koşullarının iyileşmesini bekleyin."
      case "MEDIUM":
        return "Dikkatli işlem yapın. Position size'ı azaltın."
      case "LOW":
        return "Normal risk seviyesi. Planlanan işlem yapılabilir."
      default:
        return "Risk değerlendirilemedi."
    }
  }

  calculatePositionSize(accountBalance, riskLevel, stopLossDistance) {
    let riskMultiplier = 1

    switch (riskLevel) {
      case "HIGH":
        riskMultiplier = 0.5
        break
      case "MEDIUM":
        riskMultiplier = 0.75
        break
      case "LOW":
        riskMultiplier = 1
        break
    }

    const riskAmount = accountBalance * this.maxRiskPerTrade * riskMultiplier
    const positionSize = riskAmount / stopLossDistance

    return Math.min(positionSize, accountBalance * 0.1) // Max %10 position
  }
}
