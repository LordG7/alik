const talib = require("talib")

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

  async calculateSuperTrend(symbol, period = 10, multiplier = 3) {
    const klines = await this.getKlines(symbol, "5m", 100)
    const highs = klines.map((k) => k.high)
    const lows = klines.map((k) => k.low)
    const closes = klines.map((k) => k.close)

    // Calculate ATR
    const atr = talib.ATR({
      high: highs,
      low: lows,
      close: closes,
      startIdx: 0,
      endIdx: highs.length - 1,
      optInTimePeriod: period,
    })

    // Calculate SuperTrend
    const hl2 = highs.map((high, i) => (high + lows[i]) / 2)
    const upperBand = hl2.map((hl, i) => hl + multiplier * atr.result[i])
    const lowerBand = hl2.map((hl, i) => hl - multiplier * atr.result[i])

    const trend = []
    const superTrend = []

    for (let i = 0; i < closes.length; i++) {
      if (i === 0) {
        trend[i] = 1
        superTrend[i] = lowerBand[i]
      } else {
        if (closes[i] <= superTrend[i - 1]) {
          trend[i] = -1
          superTrend[i] = upperBand[i]
        } else {
          trend[i] = 1
          superTrend[i] = lowerBand[i]
        }
      }
    }

    return {
      trend: trend[trend.length - 1],
      value: superTrend[superTrend.length - 1],
      signal:
        trend[trend.length - 1] > trend[trend.length - 2]
          ? "BUY"
          : trend[trend.length - 1] < trend[trend.length - 2]
            ? "SELL"
            : "HOLD",
    }
  }

  async calculateEMARSI(symbol) {
    const klines = await this.getKlines(symbol, "5m", 100)
    const closes = klines.map((k) => k.close)

    // Calculate EMA
    const ema20 = talib.EMA({
      inReal: closes,
      startIdx: 0,
      endIdx: closes.length - 1,
      optInTimePeriod: 20,
    })

    const ema50 = talib.EMA({
      inReal: closes,
      startIdx: 0,
      endIdx: closes.length - 1,
      optInTimePeriod: 50,
    })

    // Calculate RSI
    const rsi = talib.RSI({
      inReal: closes,
      startIdx: 0,
      endIdx: closes.length - 1,
      optInTimePeriod: 14,
    })

    const currentPrice = closes[closes.length - 1]
    const currentEMA20 = ema20.result[ema20.result.length - 1]
    const currentEMA50 = ema50.result[ema50.result.length - 1]
    const currentRSI = rsi.result[rsi.result.length - 1]

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
  }

  async calculateStochastic(symbol) {
    const klines = await this.getKlines(symbol, "5m", 100)
    const highs = klines.map((k) => k.high)
    const lows = klines.map((k) => k.low)
    const closes = klines.map((k) => k.close)

    const stoch = talib.STOCH({
      high: highs,
      low: lows,
      close: closes,
      startIdx: 0,
      endIdx: highs.length - 1,
      optInFastK_Period: 14,
      optInSlowK_Period: 3,
      optInSlowD_Period: 3,
    })

    const currentK = stoch.outSlowK[stoch.outSlowK.length - 1]
    const currentD = stoch.outSlowD[stoch.outSlowD.length - 1]

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
  }

  async calculateCCI(symbol) {
    const klines = await this.getKlines(symbol, "5m", 100)
    const highs = klines.map((k) => k.high)
    const lows = klines.map((k) => k.low)
    const closes = klines.map((k) => k.close)

    const cci = talib.CCI({
      high: highs,
      low: lows,
      close: closes,
      startIdx: 0,
      endIdx: highs.length - 1,
      optInTimePeriod: 20,
    })

    const currentCCI = cci.result[cci.result.length - 1]

    let signal = "HOLD"
    if (currentCCI > -100 && currentCCI < 100) {
      signal = "BUY"
    } else if (currentCCI < 100 && currentCCI > -100) {
      signal = "SELL"
    }

    return {
      value: currentCCI,
      signal: signal,
    }
  }

  async calculateVWAPBB(symbol) {
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
    const bb = talib.BBANDS({
      inReal: closes,
      startIdx: 0,
      endIdx: closes.length - 1,
      optInTimePeriod: 20,
      optInNbDevUp: 2,
      optInNbDevDn: 2,
    })

    const currentPrice = closes[closes.length - 1]
    const currentVWAP = vwap[vwap.length - 1]
    const upperBB = bb.outRealUpperBand[bb.outRealUpperBand.length - 1]
    const lowerBB = bb.outRealLowerBand[bb.outRealLowerBand.length - 1]

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
  }

  async getAllIndicators(symbol) {
    try {
      const [superTrend, emaRsi, stochastic, cci, vwapBB] = await Promise.all([
        this.calculateSuperTrend(symbol),
        this.calculateEMARSI(symbol),
        this.calculateStochastic(symbol),
        this.calculateCCI(symbol),
        this.calculateVWAPBB(symbol),
      ])

      return {
        superTrend,
        emaRsi,
        stochastic,
        cci,
        vwapBB,
      }
    } catch (error) {
      console.error(`Error calculating indicators for ${symbol}:`, error)
      throw error
    }
  }
}

module.exports = TechnicalAnalysis
