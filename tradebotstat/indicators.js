const { SMA, EMA, RSI, Stochastic, CCI, ATR, BollingerBands } = require("technicalindicators")

class TechnicalAnalysis {
  constructor() {
    this.indicators = {}
  }

  async analyzeAll(candles) {
    if (!candles || candles.length < 20) {
      return [
        { indicator: "SuperTrend", signal: "HOLD", value: 0 },
        { indicator: "EMA_RSI", signal: "HOLD", value: 0 },
        { indicator: "Stochastic", signal: "HOLD", value: 0 },
        { indicator: "CCI", signal: "HOLD", value: 0 },
        { indicator: "VWAP_BB", signal: "HOLD", value: 0 },
      ]
    }

    const closes = candles.map((c) => c.close)
    const highs = candles.map((c) => c.high)
    const lows = candles.map((c) => c.low)
    const volumes = candles.map((c) => c.volume)

    const signals = []

    try {
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
    } catch (error) {
      console.error("Error in technical analysis:", error)
      return [
        { indicator: "SuperTrend", signal: "HOLD", value: 0 },
        { indicator: "EMA_RSI", signal: "HOLD", value: 0 },
        { indicator: "Stochastic", signal: "HOLD", value: 0 },
        { indicator: "CCI", signal: "HOLD", value: 0 },
        { indicator: "VWAP_BB", signal: "HOLD", value: 0 },
      ]
    }

    return signals
  }

  async getSuperTrendSignal(candles) {
    try {
      const highs = candles.map((c) => c.high)
      const lows = candles.map((c) => c.low)
      const closes = candles.map((c) => c.close)

      if (closes.length < 14) {
        return { indicator: "SuperTrend", signal: "HOLD", value: 0 }
      }

      const atr = ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 10,
      })

      if (!atr || atr.length === 0) {
        return { indicator: "SuperTrend", signal: "HOLD", value: 0 }
      }

      const multiplier = 2.5
      const hl2 = candles.map((c) => (c.high + c.low) / 2)

      // Simple SuperTrend logic
      const currentPrice = closes[closes.length - 1]
      const prevPrice = closes[closes.length - 2]
      const currentATR = atr[atr.length - 1]

      const upperBand = hl2[hl2.length - 1] + multiplier * currentATR
      const lowerBand = hl2[hl2.length - 1] - multiplier * currentATR

      let signal = "HOLD"
      if (currentPrice > upperBand && prevPrice <= upperBand) signal = "BUY"
      if (currentPrice < lowerBand && prevPrice >= lowerBand) signal = "SELL"

      return { indicator: "SuperTrend", signal, value: currentPrice }
    } catch (error) {
      return { indicator: "SuperTrend", signal: "HOLD", value: 0 }
    }
  }

  async getEMARSISignal(closes) {
    try {
      if (closes.length < 14) {
        return { indicator: "EMA_RSI", signal: "HOLD", value: 50 }
      }

      const rsi = RSI.calculate({ values: closes, period: 14 })
      if (!rsi || rsi.length === 0) {
        return { indicator: "EMA_RSI", signal: "HOLD", value: 50 }
      }

      const emaRSI = EMA.calculate({ values: rsi, period: 9 })
      if (!emaRSI || emaRSI.length === 0) {
        return { indicator: "EMA_RSI", signal: "HOLD", value: 50 }
      }

      const currentRSI = emaRSI[emaRSI.length - 1]

      let signal = "HOLD"
      if (currentRSI < 35) signal = "BUY" // More sensitive
      if (currentRSI > 65) signal = "SELL" // More sensitive

      return { indicator: "EMA_RSI", signal, value: currentRSI }
    } catch (error) {
      return { indicator: "EMA_RSI", signal: "HOLD", value: 50 }
    }
  }

  async getStochasticSignal(highs, lows, closes) {
    try {
      if (closes.length < 14) {
        return { indicator: "Stochastic", signal: "HOLD", value: 50 }
      }

      const stoch = Stochastic.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
        signalPeriod: 3,
      })

      if (!stoch || stoch.length === 0) {
        return { indicator: "Stochastic", signal: "HOLD", value: 50 }
      }

      const current = stoch[stoch.length - 1]
      if (!current) return { indicator: "Stochastic", signal: "HOLD", value: 50 }

      let signal = "HOLD"
      if (current.k < 25 && current.d < 25) signal = "BUY" // More sensitive
      if (current.k > 75 && current.d > 75) signal = "SELL" // More sensitive

      return { indicator: "Stochastic", signal, value: current.k }
    } catch (error) {
      return { indicator: "Stochastic", signal: "HOLD", value: 50 }
    }
  }

  async getCCISignal(highs, lows, closes) {
    try {
      if (closes.length < 20) {
        return { indicator: "CCI", signal: "HOLD", value: 0 }
      }

      const cci = CCI.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 20,
      })

      if (!cci || cci.length === 0) {
        return { indicator: "CCI", signal: "HOLD", value: 0 }
      }

      const currentCCI = cci[cci.length - 1]

      let signal = "HOLD"
      if (currentCCI < -120) signal = "BUY" // More sensitive
      if (currentCCI > 120) signal = "SELL" // More sensitive

      return { indicator: "CCI", signal, value: currentCCI }
    } catch (error) {
      return { indicator: "CCI", signal: "HOLD", value: 0 }
    }
  }

  async getVWAPBBSignal(candles) {
    try {
      if (candles.length < 20) {
        return { indicator: "VWAP_BB", signal: "HOLD", value: 0 }
      }

      const closes = candles.map((c) => c.close)
      const volumes = candles.map((c) => c.volume)

      // Calculate VWAP
      let cumulativePV = 0
      let cumulativeV = 0

      for (let i = Math.max(0, candles.length - 20); i < candles.length; i++) {
        const typical = (candles[i].high + candles[i].low + candles[i].close) / 3
        cumulativePV += typical * volumes[i]
        cumulativeV += volumes[i]
      }

      const vwap = cumulativeV > 0 ? cumulativePV / cumulativeV : closes[closes.length - 1]

      // Calculate Bollinger Bands
      const bb = BollingerBands.calculate({
        values: closes,
        period: 20,
        stdDev: 2,
      })

      if (!bb || bb.length === 0) {
        return { indicator: "VWAP_BB", signal: "HOLD", value: 0 }
      }

      const currentBB = bb[bb.length - 1]
      const currentPrice = closes[closes.length - 1]

      let signal = "HOLD"
      if (currentPrice < currentBB.lower && currentPrice < vwap * 0.998) signal = "BUY"
      if (currentPrice > currentBB.upper && currentPrice > vwap * 1.002) signal = "SELL"

      return { indicator: "VWAP_BB", signal, value: currentPrice }
    } catch (error) {
      return { indicator: "VWAP_BB", signal: "HOLD", value: 0 }
    }
  }

  calculateATR(candles, period) {
    try {
      if (!candles || candles.length < period) return 0.001

      const highs = candles.map((c) => c.high)
      const lows = candles.map((c) => c.low)
      const closes = candles.map((c) => c.close)

      const atr = ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period,
      })

      return atr && atr.length > 0 ? atr[atr.length - 1] : 0.001
    } catch (error) {
      return 0.001
    }
  }
}

module.exports = TechnicalAnalysis
