import { Logger } from "../utils/Logger.js"

export class PatternRecognition {
  constructor() {
    this.logger = new Logger()
  }

  async detectPatterns(marketData) {
    const patterns = []
    const { closes, highs, lows, volumes } = marketData

    try {
      if (!closes || closes.length < 10) {
        return []
      }

      // 1. Basit trend analizi
      const trendPatterns = this.detectTrendPatterns(closes)
      patterns.push(...trendPatterns)

      // 2. Support/Resistance seviyeleri
      const supportResistance = this.findBasicSupportResistance(closes)
      patterns.push(...supportResistance)

      // 3. Volume pattern analizi
      if (volumes && volumes.length > 0) {
        const volumePatterns = this.detectBasicVolumePatterns(closes, volumes)
        patterns.push(...volumePatterns)
      }

      return patterns.filter((pattern) => pattern.confidence > 60)
    } catch (error) {
      this.logger.error("Pattern tanıma hatası:", error)
      return []
    }
  }

  detectTrendPatterns(closes) {
    const patterns = []
    const len = closes.length

    if (len < 10) return patterns

    // Son 10 mumda trend analizi
    const recent = closes.slice(-10)
    const trend = this.calculateSimpleTrend(recent)

    if (trend.slope > 0.001) {
      patterns.push({
        name: "Uptrend",
        type: "bullish",
        strength: 2,
        confidence: 75,
        position: len - 1,
        description: "Yükseliş trendi tespit edildi",
      })
    } else if (trend.slope < -0.001) {
      patterns.push({
        name: "Downtrend",
        type: "bearish",
        strength: 2,
        confidence: 75,
        position: len - 1,
        description: "Düşüş trendi tespit edildi",
      })
    }

    return patterns
  }

  calculateSimpleTrend(prices) {
    const n = prices.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = prices

    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    return { slope, intercept }
  }

  findBasicSupportResistance(closes) {
    const patterns = []
    const len = closes.length

    if (len < 20) return patterns

    // Son 20 mumda en yüksek ve en düşük noktaları bul
    const recent = closes.slice(-20)
    const maxPrice = Math.max(...recent)
    const minPrice = Math.min(...recent)
    const currentPrice = closes[len - 1]

    // Direnç seviyesi yakınında mı?
    if (Math.abs(currentPrice - maxPrice) / maxPrice < 0.02) {
      patterns.push({
        name: "Resistance Level",
        type: "bearish",
        strength: 2,
        confidence: 70,
        position: len - 1,
        price: maxPrice,
        description: `Direnç seviyesi: $${maxPrice.toFixed(4)}`,
      })
    }

    // Destek seviyesi yakınında mı?
    if (Math.abs(currentPrice - minPrice) / minPrice < 0.02) {
      patterns.push({
        name: "Support Level",
        type: "bullish",
        strength: 2,
        confidence: 70,
        position: len - 1,
        price: minPrice,
        description: `Destek seviyesi: $${minPrice.toFixed(4)}`,
      })
    }

    return patterns
  }

  detectBasicVolumePatterns(closes, volumes) {
    const patterns = []

    if (volumes.length < 10) return patterns

    const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
    const currentVolume = volumes[volumes.length - 1]
    const currentPrice = closes[closes.length - 1]
    const previousPrice = closes[closes.length - 2]

    // Volume spike with price movement
    if (currentVolume > avgVolume * 1.5) {
      const priceChange = (currentPrice - previousPrice) / previousPrice

      if (Math.abs(priceChange) > 0.01) {
        // %1'den fazla hareket
        patterns.push({
          name: "Volume Spike",
          type: priceChange > 0 ? "bullish" : "bearish",
          strength: 2,
          confidence: 80,
          position: closes.length - 1,
          description: `Yüksek hacimle ${priceChange > 0 ? "yükseliş" : "düşüş"}`,
        })
      }
    }

    return patterns
  }
}
