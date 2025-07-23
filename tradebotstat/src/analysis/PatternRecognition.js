import { Logger } from "../utils/Logger.js"

export class PatternRecognition {
  constructor() {
    this.logger = new Logger()
  }

  async detectPatterns(marketData) {
    const patterns = []
    const { closes, highs, lows, volumes } = marketData

    try {
      // 1. Candlestick Patterns
      patterns.push(...this.detectCandlestickPatterns(closes, highs, lows))

      // 2. Chart Patterns
      patterns.push(...this.detectChartPatterns(closes))

      // 3. Volume Patterns
      patterns.push(...this.detectVolumePatterns(closes, volumes))

      // 4. Fibonacci Patterns
      patterns.push(...this.detectFibonacciPatterns(closes, highs, lows))

      return patterns.filter((pattern) => pattern.confidence > 60)
    } catch (error) {
      this.logger.error("Pattern tanıma hatası:", error)
      return []
    }
  }

  detectCandlestickPatterns(closes, highs, lows) {
    const patterns = []
    const len = closes.length

    if (len < 3) return patterns

    // Doji Pattern
    for (let i = len - 10; i < len; i++) {
      if (i < 1) continue

      const open = i > 0 ? closes[i - 1] : closes[i]
      const close = closes[i]
      const high = highs[i]
      const low = lows[i]

      const bodySize = Math.abs(close - open)
      const totalRange = high - low

      // Doji: Küçük gövde
      if (bodySize < totalRange * 0.1) {
        patterns.push({
          name: "Doji",
          type: "neutral",
          strength: 1,
          confidence: 70,
          position: i,
          description: "Kararsızlık sinyali",
        })
      }
    }

    // Hammer Pattern
    for (let i = len - 5; i < len; i++) {
      if (i < 1) continue

      const open = i > 0 ? closes[i - 1] : closes[i]
      const close = closes[i]
      const high = highs[i]
      const low = lows[i]

      const bodySize = Math.abs(close - open)
      const lowerShadow = Math.min(open, close) - low
      const upperShadow = high - Math.max(open, close)

      // Hammer: Uzun alt gölge, kısa üst gölge
      if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5) {
        patterns.push({
          name: "Hammer",
          type: "bullish",
          strength: 2,
          confidence: 75,
          position: i,
          description: "Yükseliş dönüş sinyali",
        })
      }
    }

    return patterns
  }

  detectChartPatterns(closes) {
    const patterns = []
    const len = closes.length

    if (len < 20) return patterns

    // Support/Resistance Levels
    const supportResistance = this.findSupportResistance(closes)
    patterns.push(...supportResistance)

    // Trend Lines
    const trends = this.detectTrendLines(closes)
    patterns.push(...trends)

    // Double Top/Bottom
    const doublePatterns = this.detectDoublePatterns(closes)
    patterns.push(...doublePatterns)

    return patterns
  }

  findSupportResistance(closes) {
    const patterns = []
    const len = closes.length
    const lookback = 10

    // Son 50 mumda destek/direnç seviyeleri ara
    const levels = []

    for (let i = lookback; i < Math.min(len - lookback, len - 10); i++) {
      let isSupport = true
      let isResistance = true

      // Destek seviyesi kontrolü
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && closes[j] < closes[i]) {
          isSupport = false
          break
        }
      }

      // Direnç seviyesi kontrolü
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && closes[j] > closes[i]) {
          isResistance = false
          break
        }
      }

      if (isSupport) {
        levels.push({
          type: "support",
          price: closes[i],
          position: i,
          strength: this.calculateLevelStrength(closes, i, "support"),
        })
      }

      if (isResistance) {
        levels.push({
          type: "resistance",
          price: closes[i],
          position: i,
          strength: this.calculateLevelStrength(closes, i, "resistance"),
        })
      }
    }

    // En güçlü seviyeleri pattern olarak ekle
    levels.sort((a, b) => b.strength - a.strength)
    levels.slice(0, 3).forEach((level) => {
      patterns.push({
        name: level.type === "support" ? "Support Level" : "Resistance Level",
        type: level.type === "support" ? "bullish" : "bearish",
        strength: level.strength,
        confidence: Math.min(90, 50 + level.strength * 10),
        position: level.position,
        price: level.price,
        description: `${level.type === "support" ? "Destek" : "Direnç"} seviyesi: $${level.price.toFixed(4)}`,
      })
    })

    return patterns
  }

  calculateLevelStrength(closes, position, type) {
    let strength = 0
    const price = closes[position]
    const tolerance = price * 0.005 // %0.5 tolerans

    // Seviyeye kaç kez dokunulduğunu say
    for (let i = 0; i < closes.length; i++) {
      if (Math.abs(closes[i] - price) <= tolerance) {
        strength++
      }
    }

    return Math.min(5, strength)
  }

  detectTrendLines(closes) {
    const patterns = []
    const len = closes.length

    if (len < 30) return patterns

    // Basit trend analizi
    const shortTrend = this.calculateTrend(closes.slice(-10))
    const mediumTrend = this.calculateTrend(closes.slice(-20))
    const longTrend = this.calculateTrend(closes.slice(-30))

    if (shortTrend.slope > 0 && mediumTrend.slope > 0) {
      patterns.push({
        name: "Uptrend",
        type: "bullish",
        strength: 2,
        confidence: 80,
        position: len - 1,
        description: "Yükseliş trendi devam ediyor",
      })
    } else if (shortTrend.slope < 0 && mediumTrend.slope < 0) {
      patterns.push({
        name: "Downtrend",
        type: "bearish",
        strength: 2,
        confidence: 80,
        position: len - 1,
        description: "Düşüş trendi devam ediyor",
      })
    }

    return patterns
  }

  calculateTrend(prices) {
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

  detectDoublePatterns(closes) {
    const patterns = []
    // Double top/bottom pattern detection logic
    // Bu karmaşık bir algoritma, basitleştirilmiş versiyonu
    return patterns
  }

  detectVolumePatterns(closes, volumes) {
    const patterns = []

    if (!volumes || volumes.length < 10) return patterns

    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
    const currentVolume = volumes[volumes.length - 1]
    const currentPrice = closes[closes.length - 1]
    const previousPrice = closes[closes.length - 2]

    // Volume spike with price movement
    if (currentVolume > avgVolume * 2) {
      const priceChange = (currentPrice - previousPrice) / previousPrice

      if (Math.abs(priceChange) > 0.02) {
        // %2'den fazla hareket
        patterns.push({
          name: "Volume Spike",
          type: priceChange > 0 ? "bullish" : "bearish",
          strength: 3,
          confidence: 85,
          position: closes.length - 1,
          description: `Yüksek hacimle ${priceChange > 0 ? "yükseliş" : "düşüş"}`,
        })
      }
    }

    return patterns
  }

  detectFibonacciPatterns(closes, highs, lows) {
    const patterns = []
    const len = closes.length

    if (len < 50) return patterns

    // Son 50 mumda en yüksek ve en düşük noktaları bul
    const recentData = closes.slice(-50)
    const recentHighs = highs.slice(-50)
    const recentLows = lows.slice(-50)

    const maxPrice = Math.max(...recentHighs)
    const minPrice = Math.min(...recentLows)
    const range = maxPrice - minPrice

    // Fibonacci seviyeleri
    const fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786]
    const currentPrice = closes[len - 1]

    fibLevels.forEach((level) => {
      const fibPrice = maxPrice - range * level
      const tolerance = range * 0.01 // %1 tolerans

      if (Math.abs(currentPrice - fibPrice) <= tolerance) {
        patterns.push({
          name: `Fibonacci ${(level * 100).toFixed(1)}%`,
          type: "neutral",
          strength: 2,
          confidence: 70,
          position: len - 1,
          price: fibPrice,
          description: `Fibonacci ${(level * 100).toFixed(1)}% seviyesinde`,
        })
      }
    })

    return patterns
  }
}
