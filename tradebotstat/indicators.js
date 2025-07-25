const { SMA, EMA, RSI, Stochastic, CCI, ATR, BollingerBands } = require("technicalindicators")

class TechnicalAnalysis {
  constructor() {
    this.indicators = {}
  }

  async analyzeAll(candles) {
    const closes = candles.map((c) => c.close)
    const highs = candles.map((c) => c.high)
    const lows = candles.map((c) => c.low)
    const volumes = candles.map((c) => c.volume)

    const signals = []

    // 1. SuperTrend
    signals.push(await this.getSuperTrendSignal(candles))

    // 2. EMA RSI
    signals.push(await this.getEMARSISignal(closes))

    // 3. Stochastic
    signals.push(await this.getStochasticSignal(highs, lows, closes))

    // 4. CCI
    signals.push(await this.getCCISignal(highs, lows, closes))

    // 5. VWAP + Bollinger Bands
    signals.push(await this.getVWAPBBSignal(candles))

    return signals
  }

  async getSuperTrendSignal(candles) {
    const highs = candles.map((c) => c.high)
    const lows = candles.map((c) => c.low)
    const closes = candles.map((c) => c.close)

    const atr = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 10,
    })

    const multiplier = 3
    const period = 10

    // Simplified SuperTrend calculation
    const hl2 = candles.map((c) => (c.high + c.low) / 2)
    const upperBand = []
    const lowerBand = []

    for (let i = period - 1; i < candles.length; i++) {
      const atrValue = atr[i - period + 1] || atr[atr.length - 1]
      upperBand.push(hl2[i] + multiplier * atrValue)
      lowerBand.push(hl2[i] - multiplier * atrValue)
    }

    const currentPrice = closes[closes.length - 1]
    const currentUpper = upperBand[upperBand.length - 1]
    const currentLower = lowerBand[lowerBand.length - 1]

    let signal = "HOLD"
    if (currentPrice > currentUpper) signal = "BUY"
    if (currentPrice < currentLower) signal = "SELL"

    return { indicator: "SuperTrend", signal, value: currentPrice }
  }

  async getEMARSISignal(closes) {
    const rsi = RSI.calculate({ values: closes, period: 14 })
    const emaRSI = EMA.calculate({ values: rsi, period: 9 })

    const currentRSI = emaRSI[emaRSI.length - 1]

    let signal = "HOLD"
    if (currentRSI < 30) signal = "BUY"
    if (currentRSI > 70) signal = "SELL"

    return { indicator: "EMA_RSI", signal, value: currentRSI }
  }

  async getStochasticSignal(highs, lows, closes) {
    const stoch = Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
      signalPeriod: 3,
    })

    const current = stoch[stoch.length - 1]
    if (!current) return { indicator: "Stochastic", signal: "HOLD", value: 0 }

    let signal = "HOLD"
    if (current.k < 20 && current.d < 20) signal = "BUY"
    if (current.k > 80 && current.d > 80) signal = "SELL"

    return { indicator: "Stochastic", signal, value: current.k }
  }

  async getCCISignal(highs, lows, closes) {
    const cci = CCI.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 20,
    })

    const currentCCI = cci[cci.length - 1]

    let signal = "HOLD"
    if (currentCCI < -100) signal = "BUY"
    if (currentCCI > 100) signal = "SELL"

    return { indicator: "CCI", signal, value: currentCCI }
  }

  async getVWAPBBSignal(candles) {
    const closes = candles.map((c) => c.close)
    const volumes = candles.map((c) => c.volume)

    // Calculate VWAP
    let cumulativePV = 0
    let cumulativeV = 0

    for (let i = 0; i < candles.length; i++) {
      const typical = (candles[i].high + candles[i].low + candles[i].close) / 3
      cumulativePV += typical * volumes[i]
      cumulativeV += volumes[i]
    }

    const vwap = cumulativePV / cumulativeV

    // Calculate Bollinger Bands
    const bb = BollingerBands.calculate({
      values: closes,
      period: 20,
      stdDev: 2,
    })

    const currentBB = bb[bb.length - 1]
    const currentPrice = closes[closes.length - 1]

    let signal = "HOLD"
    if (currentPrice < currentBB.lower && currentPrice < vwap) signal = "BUY"
    if (currentPrice > currentBB.upper && currentPrice > vwap) signal = "SELL"

    return { indicator: "VWAP_BB", signal, value: currentPrice }
  }

  calculateATR(candles, period) {
    const highs = candles.map((c) => c.high)
    const lows = candles.map((c) => c.low)
    const closes = candles.map((c) => c.close)

    const atr = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period,
    })

    return atr[atr.length - 1] || 0
  }
}

module.exports = TechnicalAnalysis
