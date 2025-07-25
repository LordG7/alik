const { RSI, Stochastic, CCI, ATR, BollingerBands, EMA, VWAP } = require("technicalindicators")

class TechnicalAnalysis {
  constructor() {
    this.periods = {
      rsi: 14,
      stochastic: 14,
      cci: 20,
      atr: 14,
      bb: 20,
      ema: 21,
    }
  }

  async analyze(data) {
    const { closes, highs, lows, volumes, ohlcv } = data

    const indicators = {
      supertrend: this.calculateSuperTrend(highs, lows, closes),
      ema: this.calculateEMA(closes),
      rsi: this.calculateRSI(closes),
      stochastic: this.calculateStochastic(highs, lows, closes),
      cci: this.calculateCCI(highs, lows, closes),
      vwap: this.calculateVWAP(ohlcv),
      fractal: this.calculateFractal(highs, lows),
      atr: this.calculateATR(highs, lows, closes),
      bb: this.calculateBollingerBands(closes),
    }

    return indicators
  }

  calculateSuperTrend(highs, lows, closes) {
    const period = 10
    const multiplier = 3

    // Calculate ATR for SuperTrend
    const atr = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: period,
    })

    // Basic SuperTrend calculation
    const hl2 = highs.map((high, i) => (high + lows[i]) / 2)
    const upperBand = []
    const lowerBand = []

    for (let i = 0; i < hl2.length; i++) {
      if (atr[i - period + 1]) {
        upperBand[i] = hl2[i] + multiplier * atr[i - period + 1]
        lowerBand[i] = hl2[i] - multiplier * atr[i - period + 1]
      }
    }

    const lastClose = closes[closes.length - 1]
    const lastUpper = upperBand[upperBand.length - 1]
    const lastLower = lowerBand[lowerBand.length - 1]

    const trend = lastClose > lastLower ? "bullish" : "bearish"

    return { trend, upperBand: lastUpper, lowerBand: lastLower }
  }

  calculateEMA(closes) {
    const emaValues = EMA.calculate({
      period: this.periods.ema,
      values: closes,
    })

    const currentEMA = emaValues[emaValues.length - 1]
    const previousEMA = emaValues[emaValues.length - 2]
    const currentPrice = closes[closes.length - 1]

    let signal = "neutral"
    if (currentPrice > currentEMA && currentEMA > previousEMA) {
      signal = "bullish"
    } else if (currentPrice < currentEMA && currentEMA < previousEMA) {
      signal = "bearish"
    }

    return { value: currentEMA, signal }
  }

  calculateRSI(closes) {
    const rsiValues = RSI.calculate({
      period: this.periods.rsi,
      values: closes,
    })

    const currentRSI = rsiValues[rsiValues.length - 1]

    let signal = "neutral"
    if (currentRSI < 30) {
      signal = "bullish" // Oversold
    } else if (currentRSI > 70) {
      signal = "bearish" // Overbought
    } else if (currentRSI > 50) {
      signal = "bullish"
    } else if (currentRSI < 50) {
      signal = "bearish"
    }

    return { value: currentRSI, signal }
  }

  calculateStochastic(highs, lows, closes) {
    const stochValues = Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: this.periods.stochastic,
      signalPeriod: 3,
    })

    const current = stochValues[stochValues.length - 1]

    let signal = "neutral"
    if (current && current.k < 20 && current.d < 20) {
      signal = "bullish" // Oversold
    } else if (current && current.k > 80 && current.d > 80) {
      signal = "bearish" // Overbought
    } else if (current && current.k > current.d) {
      signal = "bullish"
    } else if (current && current.k < current.d) {
      signal = "bearish"
    }

    return { value: current, signal }
  }

  calculateCCI(highs, lows, closes) {
    const cciValues = CCI.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: this.periods.cci,
    })

    const currentCCI = cciValues[cciValues.length - 1]

    let signal = "neutral"
    if (currentCCI < -100) {
      signal = "bullish" // Oversold
    } else if (currentCCI > 100) {
      signal = "bearish" // Overbought
    } else if (currentCCI > 0) {
      signal = "bullish"
    } else if (currentCCI < 0) {
      signal = "bearish"
    }

    return { value: currentCCI, signal }
  }

  calculateVWAP(ohlcv) {
    let cumulativeTPV = 0
    let cumulativeVolume = 0

    for (const candle of ohlcv) {
      const [timestamp, open, high, low, close, volume] = candle
      const typicalPrice = (high + low + close) / 3
      cumulativeTPV += typicalPrice * volume
      cumulativeVolume += volume
    }

    const vwap = cumulativeTPV / cumulativeVolume
    const currentPrice = ohlcv[ohlcv.length - 1][4] // Close price

    const signal = currentPrice > vwap ? "bullish" : "bearish"

    return { value: vwap, signal }
  }

  calculateFractal(highs, lows) {
    const period = 5
    const recentHighs = highs.slice(-period)
    const recentLows = lows.slice(-period)

    const maxHigh = Math.max(...recentHighs)
    const minLow = Math.min(...recentLows)
    const currentHigh = highs[highs.length - 1]
    const currentLow = lows[lows.length - 1]

    let signal = "neutral"
    if (currentHigh === maxHigh) {
      signal = "bearish" // Resistance level
    } else if (currentLow === minLow) {
      signal = "bullish" // Support level
    }

    return { signal, resistance: maxHigh, support: minLow }
  }

  calculateATR(highs, lows, closes) {
    const atrValues = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: this.periods.atr,
    })

    const currentATR = atrValues[atrValues.length - 1]
    const avgATR = atrValues.reduce((sum, val) => sum + val, 0) / atrValues.length

    const volatility = currentATR > avgATR * 1.5 ? "high" : "normal"

    return { value: currentATR, volatility }
  }

  calculateBollingerBands(closes) {
    const bbValues = BollingerBands.calculate({
      period: this.periods.bb,
      values: closes,
      stdDev: 2,
    })

    const current = bbValues[bbValues.length - 1]
    const currentPrice = closes[closes.length - 1]

    let signal = "neutral"
    if (current) {
      if (currentPrice <= current.lower) {
        signal = "bullish" // Price at lower band
      } else if (currentPrice >= current.upper) {
        signal = "bearish" // Price at upper band
      } else if (currentPrice > current.middle) {
        signal = "bullish"
      } else if (currentPrice < current.middle) {
        signal = "bearish"
      }
    }

    return { value: current, signal }
  }
}

module.exports = TechnicalAnalysis
