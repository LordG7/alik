const { EMA, RSI, Stochastic, CCI, ATR, BollingerBands, MACD, VWAP } = require("technical-indicators")
const config = require("../config/config")
const logger = require("../utils/logger")

class TechnicalAnalysisService {
  constructor() {
    this.indicators = config.indicators
  }

  calculateIndicators(ohlcData) {
    try {
      const closes = ohlcData.map((d) => d.close)
      const highs = ohlcData.map((d) => d.high)
      const lows = ohlcData.map((d) => d.low)
      const volumes = ohlcData.map((d) => d.volume)

      // EMA calculations
      const emaFast = EMA.calculate({
        period: this.indicators.ema.fast,
        values: closes,
      })

      const emaSlow = EMA.calculate({
        period: this.indicators.ema.slow,
        values: closes,
      })

      // RSI
      const rsi = RSI.calculate({
        period: this.indicators.rsi.period,
        values: closes,
      })

      // Stochastic
      const stochastic = Stochastic.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: this.indicators.stochastic.kPeriod,
        signalPeriod: this.indicators.stochastic.dPeriod,
      })

      // CCI
      const cci = CCI.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: this.indicators.cci.period,
      })

      // ATR
      const atr = ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: this.indicators.atr.period,
      })

      // Bollinger Bands
      const bb = BollingerBands.calculate({
        period: this.indicators.bollinger.period,
        stdDev: this.indicators.bollinger.stdDev,
        values: closes,
      })

      // MACD
      const macd = MACD.calculate({
        fastPeriod: this.indicators.macd.fast,
        slowPeriod: this.indicators.macd.slow,
        signalPeriod: this.indicators.macd.signal,
        values: closes,
      })

      // VWAP (simplified calculation)
      const vwap = this.calculateVWAP(ohlcData)

      // SuperTrend (custom implementation)
      const superTrend = this.calculateSuperTrend(highs, lows, closes, atr)

      return {
        emaFast: emaFast[emaFast.length - 1],
        emaSlow: emaSlow[emaSlow.length - 1],
        rsi: rsi[rsi.length - 1],
        stochastic: stochastic[stochastic.length - 1],
        cci: cci[cci.length - 1],
        atr: atr[atr.length - 1],
        bb: bb[bb.length - 1],
        macd: macd[macd.length - 1],
        vwap: vwap[vwap.length - 1],
        superTrend: superTrend[superTrend.length - 1],
        currentPrice: closes[closes.length - 1],
      }
    } catch (error) {
      logger.error("Error calculating indicators:", error)
      return null
    }
  }

  calculateVWAP(ohlcData) {
    const vwap = []
    let cumulativeTPV = 0
    let cumulativeVolume = 0

    for (let i = 0; i < ohlcData.length; i++) {
      const typicalPrice = (ohlcData[i].high + ohlcData[i].low + ohlcData[i].close) / 3
      const tpv = typicalPrice * ohlcData[i].volume

      cumulativeTPV += tpv
      cumulativeVolume += ohlcData[i].volume

      vwap.push(cumulativeTPV / cumulativeVolume)
    }

    return vwap
  }

  calculateSuperTrend(highs, lows, closes, atr, multiplier = 3) {
    const superTrend = []
    const hl2 = highs.map((high, i) => (high + lows[i]) / 2)

    for (let i = 0; i < closes.length; i++) {
      if (i === 0) {
        superTrend.push({ value: hl2[i], trend: 1 })
        continue
      }

      const upperBand = hl2[i] + multiplier * atr[i]
      const lowerBand = hl2[i] - multiplier * atr[i]

      let trend = superTrend[i - 1].trend
      let value = superTrend[i - 1].value

      if (closes[i] > upperBand) {
        trend = 1
        value = lowerBand
      } else if (closes[i] < lowerBand) {
        trend = -1
        value = upperBand
      }

      superTrend.push({ value, trend })
    }

    return superTrend
  }

  generateSignal(indicators) {
    if (!indicators) return null

    const signals = []
    let confidence = 0

    // EMA Crossover Signal
    if (indicators.emaFast > indicators.emaSlow) {
      signals.push("EMA_BULLISH")
      confidence += 15
    } else {
      signals.push("EMA_BEARISH")
      confidence += 15
    }

    // RSI Signal
    if (indicators.rsi < this.indicators.rsi.oversold) {
      signals.push("RSI_OVERSOLD")
      confidence += 20
    } else if (indicators.rsi > this.indicators.rsi.overbought) {
      signals.push("RSI_OVERBOUGHT")
      confidence += 20
    }

    // CCI Signal
    if (indicators.cci < this.indicators.cci.oversold) {
      signals.push("CCI_OVERSOLD")
      confidence += 15
    } else if (indicators.cci > this.indicators.cci.overbought) {
      signals.push("CCI_OVERBOUGHT")
      confidence += 15
    }

    // SuperTrend Signal
    if (indicators.superTrend.trend === 1) {
      signals.push("SUPERTREND_BULLISH")
      confidence += 25
    } else {
      signals.push("SUPERTREND_BEARISH")
      confidence += 25
    }

    // VWAP Signal
    if (indicators.currentPrice > indicators.vwap) {
      signals.push("VWAP_ABOVE")
      confidence += 10
    } else {
      signals.push("VWAP_BELOW")
      confidence += 10
    }

    // Bollinger Bands Signal
    if (indicators.bb && indicators.currentPrice > indicators.bb.upper) {
      signals.push("BB_BREAKOUT_UP")
      confidence += 15
    } else if (indicators.bb && indicators.currentPrice < indicators.bb.lower) {
      signals.push("BB_BREAKOUT_DOWN")
      confidence += 15
    }

    // Determine overall signal
    const bullishSignals = signals.filter(
      (s) => s.includes("BULLISH") || s.includes("OVERSOLD") || s.includes("ABOVE") || s.includes("BREAKOUT_DOWN"),
    ).length

    const bearishSignals = signals.filter(
      (s) => s.includes("BEARISH") || s.includes("OVERBOUGHT") || s.includes("BELOW") || s.includes("BREAKOUT_UP"),
    ).length

    if (confidence >= 70 && bullishSignals > bearishSignals) {
      return this.createSignal("BUY", indicators, confidence, signals)
    } else if (confidence >= 70 && bearishSignals > bullishSignals) {
      return this.createSignal("SELL", indicators, confidence, signals)
    }

    return null
  }

  createSignal(type, indicators, confidence, signals) {
    const atrMultiplier = 2
    const stopLoss =
      type === "BUY"
        ? indicators.currentPrice - indicators.atr * atrMultiplier
        : indicators.currentPrice + indicators.atr * atrMultiplier

    const takeProfit =
      type === "BUY"
        ? indicators.currentPrice + indicators.atr * atrMultiplier
        : indicators.currentPrice - indicators.atr * atrMultiplier

    return {
      type,
      entryPrice: indicators.currentPrice,
      stopLoss: Number.parseFloat(stopLoss.toFixed(2)),
      takeProfit: Number.parseFloat(takeProfit.toFixed(2)),
      confidence: Math.min(confidence, 100),
      indicators: {
        ema: { fast: indicators.emaFast, slow: indicators.emaSlow },
        rsi: indicators.rsi,
        cci: indicators.cci,
        atr: indicators.atr,
        vwap: indicators.vwap,
        superTrend: indicators.superTrend,
        signals,
      },
      timestamp: new Date().toISOString(),
    }
  }
}

module.exports = new TechnicalAnalysisService()
