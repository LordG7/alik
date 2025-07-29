// Custom technical indicators implementation since we're using TradingView data

class TechnicalIndicators {
  // Simple Moving Average
  static SMA(data, period) {
    const result = []
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      result.push(sum / period)
    }
    return result
  }

  // Exponential Moving Average
  static EMA(data, period) {
    const result = []
    const multiplier = 2 / (period + 1)

    // First EMA is SMA
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period
    result.push(ema)

    for (let i = period; i < data.length; i++) {
      ema = data[i] * multiplier + ema * (1 - multiplier)
      result.push(ema)
    }

    return result
  }

  // Relative Strength Index
  static RSI(data, period = 14) {
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
        const rsi = 100 - 100 / (1 + rs)
        result.push(rsi)
      }
    }

    return result
  }

  // Stochastic Oscillator
  static Stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    const kValues = []

    for (let i = kPeriod - 1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1))
      const lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1))

      const k = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100
      kValues.push(k)
    }

    const dValues = this.SMA(kValues, dPeriod)

    return kValues.map((k, i) => ({
      k: k,
      d: dValues[i - dPeriod + 1] || null,
    }))
  }

  // Commodity Channel Index
  static CCI(highs, lows, closes, period = 20) {
    const typicalPrices = closes.map((close, i) => (highs[i] + lows[i] + close) / 3)
    const smaTP = this.SMA(typicalPrices, period)

    const result = []

    for (let i = period - 1; i < typicalPrices.length; i++) {
      const tp = typicalPrices[i]
      const sma = smaTP[i - period + 1]

      const meanDeviation =
        typicalPrices.slice(i - period + 1, i + 1).reduce((sum, value) => sum + Math.abs(value - sma), 0) / period

      const cci = (tp - sma) / (0.015 * meanDeviation)
      result.push(cci)
    }

    return result
  }

  // Average True Range
  static ATR(highs, lows, closes, period = 14) {
    const trueRanges = []

    for (let i = 1; i < closes.length; i++) {
      const tr1 = highs[i] - lows[i]
      const tr2 = Math.abs(highs[i] - closes[i - 1])
      const tr3 = Math.abs(lows[i] - closes[i - 1])

      trueRanges.push(Math.max(tr1, tr2, tr3))
    }

    return this.SMA(trueRanges, period)
  }

  // Bollinger Bands
  static BollingerBands(data, period = 20, stdDev = 2) {
    const sma = this.SMA(data, period)
    const result = []

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1)
      const mean = sma[i - period + 1]

      const variance = slice.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / period
      const standardDeviation = Math.sqrt(variance)

      result.push({
        upper: mean + standardDeviation * stdDev,
        middle: mean,
        lower: mean - standardDeviation * stdDev,
      })
    }

    return result
  }

  // MACD
  static MACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const emaFast = this.EMA(data, fastPeriod)
    const emaSlow = this.EMA(data, slowPeriod)

    const macdLine = []
    const startIndex = slowPeriod - fastPeriod

    for (let i = 0; i < emaFast.length - startIndex; i++) {
      macdLine.push(emaFast[i + startIndex] - emaSlow[i])
    }

    const signalLine = this.EMA(macdLine, signalPeriod)
    const histogram = []

    for (let i = signalPeriod - 1; i < macdLine.length; i++) {
      histogram.push(macdLine[i] - signalLine[i - signalPeriod + 1])
    }

    return macdLine.map((macd, i) => ({
      macd: macd,
      signal: signalLine[i - signalPeriod + 1] || null,
      histogram: histogram[i - signalPeriod + 1] || null,
    }))
  }

  // VWAP (Volume Weighted Average Price)
  static VWAP(highs, lows, closes, volumes) {
    const result = []
    let cumulativeTPV = 0
    let cumulativeVolume = 0

    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3
      const tpv = typicalPrice * volumes[i]

      cumulativeTPV += tpv
      cumulativeVolume += volumes[i]

      result.push(cumulativeTPV / cumulativeVolume)
    }

    return result
  }

  // SuperTrend
  static SuperTrend(highs, lows, closes, period = 10, multiplier = 3) {
    const atr = this.ATR(highs, lows, closes, period)
    const hl2 = highs.map((high, i) => (high + lows[i]) / 2)

    const result = []

    for (let i = 0; i < closes.length; i++) {
      if (i < period) {
        result.push({ value: hl2[i], trend: 1 })
        continue
      }

      const atrValue = atr[i - period]
      const upperBand = hl2[i] + multiplier * atrValue
      const lowerBand = hl2[i] - multiplier * atrValue

      let trend = result[i - 1].trend
      let value = result[i - 1].value

      if (closes[i] > upperBand) {
        trend = 1
        value = lowerBand
      } else if (closes[i] < lowerBand) {
        trend = -1
        value = upperBand
      }

      result.push({ value, trend })
    }

    return result
  }
}

module.exports = TechnicalIndicators
