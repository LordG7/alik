export class TechnicalAnalysis {
  async getSignal(marketData, timeframe) {
    const { closes, highs, lows, volumes } = marketData

    if (closes.length < 20) {
      return { direction: "HOLD", strength: 0, timeframe, reason: "Az data" }
    }

    let longSignals = 0
    let shortSignals = 0
    const reasons = []

    // 1. Moving Average analizi
    const sma20 = this.calculateSMA(closes, 20)
    const sma50 = this.calculateSMA(closes, 50)
    const currentPrice = closes[closes.length - 1]

    if (currentPrice > sma20[sma20.length - 1]) {
      longSignals += 2
      reasons.push("Qiymət SMA20 üzərində")
    } else {
      shortSignals += 2
      reasons.push("Qiymət SMA20 altında")
    }

    if (sma20.length > 1 && sma50.length > 1) {
      if (sma20[sma20.length - 1] > sma50[sma50.length - 1]) {
        longSignals += 1
        reasons.push("SMA20 > SMA50")
      } else {
        shortSignals += 1
        reasons.push("SMA20 < SMA50")
      }
    }

    // 2. RSI analizi
    const rsi = this.calculateRSI(closes, 14)
    const currentRSI = rsi[rsi.length - 1]

    if (currentRSI < 30) {
      longSignals += 3
      reasons.push(`RSI aşırı satış (${currentRSI.toFixed(1)})`)
    } else if (currentRSI > 70) {
      shortSignals += 3
      reasons.push(`RSI aşırı alım (${currentRSI.toFixed(1)})`)
    } else if (currentRSI < 45) {
      longSignals += 1
      reasons.push("RSI zəif")
    } else if (currentRSI > 55) {
      shortSignals += 1
      reasons.push("RSI güclü")
    }

    // 3. MACD analizi
    const macd = this.calculateMACD(closes)
    if (macd.length > 1) {
      const currentMACD = macd[macd.length - 1]
      const prevMACD = macd[macd.length - 2]

      if (currentMACD.macd > currentMACD.signal) {
        longSignals += 2
        reasons.push("MACD bullish")
      } else {
        shortSignals += 2
        reasons.push("MACD bearish")
      }

      if (currentMACD.macd > prevMACD.macd) {
        longSignals += 1
        reasons.push("MACD yüksəlir")
      } else {
        shortSignals += 1
        reasons.push("MACD düşür")
      }
    }

    // 4. Bollinger Bands
    const bb = this.calculateBollingerBands(closes, 20, 2)
    if (bb.length > 0) {
      const currentBB = bb[bb.length - 1]

      if (currentPrice < currentBB.lower) {
        longSignals += 2
        reasons.push("Qiymət BB alt bandında")
      } else if (currentPrice > currentBB.upper) {
        shortSignals += 2
        reasons.push("Qiymət BB üst bandında")
      }
    }

    // 5. Volume analizi
    const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
    const currentVolume = volumes[volumes.length - 1]

    if (currentVolume > avgVolume * 1.5) {
      // Yüksək volume, trend gücləndirir
      if (longSignals > shortSignals) {
        longSignals += 1
        reasons.push("Yüksək volume + bullish")
      } else {
        shortSignals += 1
        reasons.push("Yüksək volume + bearish")
      }
    }

    // Nəticə hesabla
    const totalSignals = longSignals + shortSignals
    const strength = totalSignals > 0 ? Math.round((Math.max(longSignals, shortSignals) / totalSignals) * 100) : 50
    const direction = longSignals > shortSignals ? "LONG" : shortSignals > longSignals ? "SHORT" : "HOLD"

    return {
      direction,
      strength,
      timeframe,
      reason: reasons.slice(0, 2).join(", "),
      longSignals,
      shortSignals,
      rsi: currentRSI?.toFixed(1) || "N/A",
    }
  }

  calculateSMA(data, period) {
    const result = []
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      result.push(sum / period)
    }
    return result
  }

  calculateRSI(data, period) {
    const gains = []
    const losses = []

    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1]
      gains.push(change > 0 ? change : 0)
      losses.push(change < 0 ? Math.abs(change) : 0)
    }

    const result = []
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period

      if (avgLoss === 0) {
        result.push(100)
      } else {
        const rs = avgGain / avgLoss
        result.push(100 - 100 / (1 + rs))
      }
    }

    return result
  }

  calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const emaFast = this.calculateEMA(data, fastPeriod)
    const emaSlow = this.calculateEMA(data, slowPeriod)

    const macdLine = []
    const start = Math.max(emaFast.length, emaSlow.length) - Math.min(emaFast.length, emaSlow.length)

    for (let i = start; i < Math.min(emaFast.length, emaSlow.length); i++) {
      macdLine.push(emaFast[i] - emaSlow[i])
    }

    const signalLine = this.calculateEMA(macdLine, signalPeriod)

    const result = []
    const signalStart = macdLine.length - signalLine.length

    for (let i = signalStart; i < macdLine.length; i++) {
      result.push({
        macd: macdLine[i],
        signal: signalLine[i - signalStart],
        histogram: macdLine[i] - signalLine[i - signalStart],
      })
    }

    return result
  }

  calculateEMA(data, period) {
    const result = []
    const multiplier = 2 / (period + 1)

    result[0] = data[0]

    for (let i = 1; i < data.length; i++) {
      result[i] = data[i] * multiplier + result[i - 1] * (1 - multiplier)
    }

    return result
  }

  calculateBollingerBands(data, period, stdDev) {
    const sma = this.calculateSMA(data, period)
    const result = []

    for (let i = 0; i < sma.length; i++) {
      const dataSlice = data.slice(i, i + period)
      const mean = sma[i]
      const variance = dataSlice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
      const standardDeviation = Math.sqrt(variance)

      result.push({
        middle: mean,
        upper: mean + standardDeviation * stdDev,
        lower: mean - standardDeviation * stdDev,
      })
    }

    return result
  }
}
