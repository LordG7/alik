class TechnicalAnalysis {
  constructor(binanceClient) {
    this.binance = binanceClient
  }

  async getKlines(symbol, interval = "5m", limit = 100) {
    try {
      const klines = await this.binance.candles({
        symbol: symbol,
        interval: interval,
        limit: limit,
      })

      return klines.map((kline) => ({
        time: kline.openTime,
        open: Number.parseFloat(kline.open),
        high: Number.parseFloat(kline.high),
        low: Number.parseFloat(kline.low),
        close: Number.parseFloat(kline.close),
        volume: Number.parseFloat(kline.volume),
      }))
    } catch (error) {
      console.error(`Error fetching klines for ${symbol}:`, error)
      throw error
    }
  }

  // Custom ATR calculation
  calculateATR(highs, lows, closes, period = 14) {
    const trueRanges = []

    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i]
      const tr2 = Math.abs(highs[i] - closes[i - 1])
      const tr3 = Math.abs(lows[i] - closes[i - 1])
      trueRanges.push(Math.max(tr1, tr2, tr3))
    }

    const atrValues = []
    for (let i = period - 1; i < trueRanges.length; i++) {
      const sum = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      atrValues.push(sum / period)
    }

    return atrValues
  }

  // Custom EMA calculation
  calculateEMA(values, period) {
    const multiplier = 2 / (period + 1)
    const emaValues = [values[0]]

    for (let i = 1; i < values.length; i++) {
      const ema = (values[i] - emaValues[i - 1]) * multiplier + emaValues[i - 1]
      emaValues.push(ema)
    }

    return emaValues
  }

  // Custom RSI calculation
  calculateRSI(closes, period = 14) {
    const changes = []
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1])
    }

    const gains = changes.map((change) => (change > 0 ? change : 0))
    const losses = changes.map((change) => (change < 0 ? Math.abs(change) : 0))

    const rsiValues = []
    for (let i = period - 1; i < changes.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period

      if (avgLoss === 0) {
        rsiValues.push(100)
      } else {
        const rs = avgGain / avgLoss
        const rsi = 100 - 100 / (1 + rs)
        rsiValues.push(rsi)
      }
    }

    return rsiValues
  }

  // Custom Stochastic calculation
  calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    const kValues = []

    for (let i = kPeriod - 1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1))
      const lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1))

      if (highestHigh === lowestLow) {
        kValues.push(50)
      } else {
        const k = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100
        kValues.push(k)
      }
    }

    // Calculate %D (SMA of %K)
    const dValues = []
    for (let i = dPeriod - 1; i < kValues.length; i++) {
      const sum = kValues.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0)
      dValues.push(sum / dPeriod)
    }

    return { k: kValues, d: dValues }
  }

  // Custom CCI calculation
  calculateCCI(highs, lows, closes, period = 20) {
    const typicalPrices = []
    for (let i = 0; i < closes.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3)
    }

    const cciValues = []
    for (let i = period - 1; i < typicalPrices.length; i++) {
      const sma = typicalPrices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period

      let meanDeviation = 0
      for (let j = i - period + 1; j <= i; j++) {
        meanDeviation += Math.abs(typicalPrices[j] - sma)
      }
      meanDeviation /= period

      if (meanDeviation === 0) {
        cciValues.push(0)
      } else {
        const cci = (typicalPrices[i] - sma) / (0.015 * meanDeviation)
        cciValues.push(cci)
      }
    }

    return cciValues
  }

  // Custom Bollinger Bands calculation
  calculateBollingerBands(closes, period = 20, stdDev = 2) {
    const smaValues = []
    const upperBands = []
    const lowerBands = []

    for (let i = period - 1; i < closes.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1)
      const sma = slice.reduce((a, b) => a + b, 0) / period

      const variance = slice.reduce((sum, value) => sum + Math.pow(value - sma, 2), 0) / period
      const standardDeviation = Math.sqrt(variance)

      smaValues.push(sma)
      upperBands.push(sma + standardDeviation * stdDev)
      lowerBands.push(sma - standardDeviation * stdDev)
    }

    return { sma: smaValues, upper: upperBands, lower: lowerBands }
  }

  async calculateSuperTrend(symbol, period = 10, multiplier = 3) {
    try {
      const klines = await this.getKlines(symbol, "5m", 100)
      const highs = klines.map((k) => k.high)
      const lows = klines.map((k) => k.low)
      const closes = klines.map((k) => k.close)

      // Calculate ATR
      const atrValues = this.calculateATR(highs, lows, closes, period)

      // Calculate SuperTrend
      const hl2 = highs.map((high, i) => (high + lows[i]) / 2)
      const superTrend = []
      const trend = []

      for (let i = 0; i < atrValues.length; i++) {
        const atrIndex = i + period
        const upperBand = hl2[atrIndex] + multiplier * atrValues[i]
        const lowerBand = hl2[atrIndex] - multiplier * atrValues[i]

        if (i === 0) {
          trend[i] = 1
          superTrend[i] = lowerBand
        } else {
          if (closes[atrIndex] <= superTrend[i - 1]) {
            trend[i] = -1
            superTrend[i] = upperBand
          } else {
            trend[i] = 1
            superTrend[i] = lowerBand
          }
        }
      }

      const lastTrend = trend[trend.length - 1]
      const prevTrend = trend[trend.length - 2] || lastTrend

      return {
        trend: lastTrend,
        value: superTrend[superTrend.length - 1],
        signal: lastTrend > prevTrend ? "BUY" : lastTrend < prevTrend ? "SELL" : "HOLD",
      }
    } catch (error) {
      console.error(`Error calculating SuperTrend for ${symbol}:`, error)
      return { trend: 0, value: 0, signal: "HOLD" }
    }
  }

  async calculateEMARSI(symbol) {
    try {
      const klines = await this.getKlines(symbol, "5m", 100)
      const closes = klines.map((k) => k.close)

      // Calculate EMAs
      const ema20 = this.calculateEMA(closes, 20)
      const ema50 = this.calculateEMA(closes, 50)

      // Calculate RSI
      const rsiValues = this.calculateRSI(closes, 14)

      const currentPrice = closes[closes.length - 1]
      const currentEMA20 = ema20[ema20.length - 1]
      const currentEMA50 = ema50[ema50.length - 1]
      const currentRSI = rsiValues[rsiValues.length - 1]

      let signal = "HOLD"
      if (currentPrice > currentEMA20 && currentEMA20 > currentEMA50 && currentRSI < 70) {
        signal = "BUY"
      } else if (currentPrice < currentEMA20 && currentEMA20 < currentEMA50 && currentRSI > 30) {
        signal = "SELL"
      }

      return {
        ema20: currentEMA20,
        ema50: currentEMA50,
        rsi: currentRSI,
        signal: signal,
      }
    } catch (error) {
      console.error(`Error calculating EMA/RSI for ${symbol}:`, error)
      return { ema20: 0, ema50: 0, rsi: 50, signal: "HOLD" }
    }
  }

  async calculateStochastic(symbol) {
    try {
      const klines = await this.getKlines(symbol, "5m", 100)
      const highs = klines.map((k) => k.high)
      const lows = klines.map((k) => k.low)
      const closes = klines.map((k) => k.close)

      const stoch = this.calculateStochastic(highs, lows, closes, 14, 3)

      const currentK = stoch.k[stoch.k.length - 1]
      const currentD = stoch.d[stoch.d.length - 1]

      let signal = "HOLD"
      if (currentK > currentD && currentK < 80) {
        signal = "BUY"
      } else if (currentK < currentD && currentK > 20) {
        signal = "SELL"
      }

      return {
        k: currentK,
        d: currentD,
        signal: signal,
      }
    } catch (error) {
      console.error(`Error calculating Stochastic for ${symbol}:`, error)
      return { k: 50, d: 50, signal: "HOLD" }
    }
  }

  async calculateCCI(symbol) {
    try {
      const klines = await this.getKlines(symbol, "5m", 100)
      const highs = klines.map((k) => k.high)
      const lows = klines.map((k) => k.low)
      const closes = klines.map((k) => k.close)

      const cciValues = this.calculateCCI(highs, lows, closes, 20)
      const currentCCI = cciValues[cciValues.length - 1]

      let signal = "HOLD"
      if (currentCCI > -100 && currentCCI < 100) {
        if (currentCCI > 0) signal = "BUY"
        else signal = "SELL"
      }

      return {
        value: currentCCI,
        signal: signal,
      }
    } catch (error) {
      console.error(`Error calculating CCI for ${symbol}:`, error)
      return { value: 0, signal: "HOLD" }
    }
  }

  async calculateVWAPBB(symbol) {
    try {
      const klines = await this.getKlines(symbol, "5m", 100)
      const highs = klines.map((k) => k.high)
      const lows = klines.map((k) => k.low)
      const closes = klines.map((k) => k.close)
      const volumes = klines.map((k) => k.volume)

      // Calculate VWAP
      let cumulativePV = 0
      let cumulativeVolume = 0
      const vwap = []

      for (let i = 0; i < closes.length; i++) {
        const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3
        cumulativePV += typicalPrice * volumes[i]
        cumulativeVolume += volumes[i]
        vwap[i] = cumulativePV / cumulativeVolume
      }

      // Calculate Bollinger Bands
      const bb = this.calculateBollingerBands(closes, 20, 2)

      const currentPrice = closes[closes.length - 1]
      const currentVWAP = vwap[vwap.length - 1]
      const upperBB = bb.upper[bb.upper.length - 1]
      const lowerBB = bb.lower[bb.lower.length - 1]

      let signal = "HOLD"
      if (currentPrice > currentVWAP && currentPrice < upperBB) {
        signal = "BUY"
      } else if (currentPrice < currentVWAP && currentPrice > lowerBB) {
        signal = "SELL"
      }

      return {
        vwap: currentVWAP,
        upperBB: upperBB,
        lowerBB: lowerBB,
        signal: signal,
      }
    } catch (error) {
      console.error(`Error calculating VWAP/BB for ${symbol}:`, error)
      return { vwap: 0, upperBB: 0, lowerBB: 0, signal: "HOLD" }
    }
  }

  async getAllIndicators(symbol) {
    try {
      console.log(`📊 Calculating indicators for ${symbol}...`)

      const [superTrend, emaRsi, stochastic, cci, vwapBB] = await Promise.all([
        this.calculateSuperTrend(symbol).catch((err) => {
          console.error(`SuperTrend error for ${symbol}:`, err.message)
          return { trend: 0, value: 0, signal: "HOLD" }
        }),
        this.calculateEMARSI(symbol).catch((err) => {
          console.error(`EMA/RSI error for ${symbol}:`, err.message)
          return { ema20: 0, ema50: 0, rsi: 50, signal: "HOLD" }
        }),
        this.calculateStochastic(symbol).catch((err) => {
          console.error(`Stochastic error for ${symbol}:`, err.message)
          return { k: 50, d: 50, signal: "HOLD" }
        }),
        this.calculateCCI(symbol).catch((err) => {
          console.error(`CCI error for ${symbol}:`, err.message)
          return { value: 0, signal: "HOLD" }
        }),
        this.calculateVWAPBB(symbol).catch((err) => {
          console.error(`VWAP/BB error for ${symbol}:`, err.message)
          return { vwap: 0, upperBB: 0, lowerBB: 0, signal: "HOLD" }
        }),
      ])

      console.log(`✅ Indicators calculated for ${symbol}`)

      return {
        superTrend,
        emaRsi,
        stochastic,
        cci,
        vwapBB,
      }
    } catch (error) {
      console.error(`❌ Error calculating indicators for ${symbol}:`, error)
      // Return default values to prevent crashes
      return {
        superTrend: { trend: 0, value: 0, signal: "HOLD" },
        emaRsi: { ema20: 0, ema50: 0, rsi: 50, signal: "HOLD" },
        stochastic: { k: 50, d: 50, signal: "HOLD" },
        cci: { value: 0, signal: "HOLD" },
        vwapBB: { vwap: 0, upperBB: 0, lowerBB: 0, signal: "HOLD" },
      }
    }
  }
}

module.exports = TechnicalAnalysis
