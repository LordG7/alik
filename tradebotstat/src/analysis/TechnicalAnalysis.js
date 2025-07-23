import {
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
  Stochastic,
  Williams,
  ADX,
  CCI,
  MFI,
  OBV,
  VWAP,
  ParabolicSAR,
} from "technicalindicators"

export class TechnicalAnalysis {
  constructor() {
    this.indicators = [
      "SMA_20",
      "SMA_50",
      "EMA_12",
      "EMA_26",
      "RSI",
      "MACD",
      "BollingerBands",
      "Stochastic",
      "Williams",
      "ADX",
      "CCI",
      "MFI",
      "OBV",
      "VWAP",
      "ParabolicSAR",
    ]
  }

  async analyze(marketData) {
    const results = []
    const { prices, volumes, highs, lows, closes } = marketData

    try {
      // 1. Simple Moving Average (20)
      const sma20 = SMA.calculate({ period: 20, values: closes })
      const currentPrice = closes[closes.length - 1]
      const sma20Current = sma20[sma20.length - 1]

      results.push({
        name: "SMA_20",
        value: sma20Current?.toFixed(4),
        signal: currentPrice > sma20Current ? "BUY" : "SELL",
        weight: 1.5,
      })

      // 2. Simple Moving Average (50)
      const sma50 = SMA.calculate({ period: 50, values: closes })
      const sma50Current = sma50[sma50.length - 1]

      results.push({
        name: "SMA_50",
        value: sma50Current?.toFixed(4),
        signal: currentPrice > sma50Current ? "BUY" : "SELL",
        weight: 2,
      })

      // 3. Exponential Moving Average (12)
      const ema12 = EMA.calculate({ period: 12, values: closes })
      const ema12Current = ema12[ema12.length - 1]

      results.push({
        name: "EMA_12",
        value: ema12Current?.toFixed(4),
        signal: currentPrice > ema12Current ? "BUY" : "SELL",
        weight: 1.5,
      })

      // 4. RSI (Relative Strength Index)
      const rsi = RSI.calculate({ period: 14, values: closes })
      const rsiCurrent = rsi[rsi.length - 1]

      let rsiSignal = "HOLD"
      if (rsiCurrent < 30) rsiSignal = "BUY"
      else if (rsiCurrent > 70) rsiSignal = "SELL"

      results.push({
        name: "RSI",
        value: rsiCurrent?.toFixed(2),
        signal: rsiSignal,
        weight: 2.5,
      })

      // 5. MACD
      const macd = MACD.calculate({
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        values: closes,
      })
      const macdCurrent = macd[macd.length - 1]

      results.push({
        name: "MACD",
        value: macdCurrent?.MACD?.toFixed(4),
        signal: macdCurrent?.MACD > macdCurrent?.signal ? "BUY" : "SELL",
        weight: 2,
      })

      // 6. Bollinger Bands
      const bb = BollingerBands.calculate({
        period: 20,
        stdDev: 2,
        values: closes,
      })
      const bbCurrent = bb[bb.length - 1]

      let bbSignal = "HOLD"
      if (currentPrice < bbCurrent?.lower) bbSignal = "BUY"
      else if (currentPrice > bbCurrent?.upper) bbSignal = "SELL"

      results.push({
        name: "BollingerBands",
        value: `${bbCurrent?.middle?.toFixed(4)}`,
        signal: bbSignal,
        weight: 1.5,
      })

      // 7. Stochastic Oscillator
      const stoch = Stochastic.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
        signalPeriod: 3,
      })
      const stochCurrent = stoch[stoch.length - 1]

      let stochSignal = "HOLD"
      if (stochCurrent?.k < 20) stochSignal = "BUY"
      else if (stochCurrent?.k > 80) stochSignal = "SELL"

      results.push({
        name: "Stochastic",
        value: stochCurrent?.k?.toFixed(2),
        signal: stochSignal,
        weight: 1.5,
      })

      // 8. Williams %R
      const williams = Williams.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      })
      const williamsCurrent = williams[williams.length - 1]

      let williamsSignal = "HOLD"
      if (williamsCurrent < -80) williamsSignal = "BUY"
      else if (williamsCurrent > -20) williamsSignal = "SELL"

      results.push({
        name: "Williams_R",
        value: williamsCurrent?.toFixed(2),
        signal: williamsSignal,
        weight: 1,
      })

      // 9. ADX (Average Directional Index)
      const adx = ADX.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      })
      const adxCurrent = adx[adx.length - 1]

      results.push({
        name: "ADX",
        value: adxCurrent?.adx?.toFixed(2),
        signal: adxCurrent?.adx > 25 ? (adxCurrent?.pdi > adxCurrent?.mdi ? "BUY" : "SELL") : "HOLD",
        weight: 2,
      })

      // 10. CCI (Commodity Channel Index)
      const cci = CCI.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 20,
      })
      const cciCurrent = cci[cci.length - 1]

      let cciSignal = "HOLD"
      if (cciCurrent < -100) cciSignal = "BUY"
      else if (cciCurrent > 100) cciSignal = "SELL"

      results.push({
        name: "CCI",
        value: cciCurrent?.toFixed(2),
        signal: cciSignal,
        weight: 1.5,
      })

      // 11. MFI (Money Flow Index)
      const mfi = MFI.calculate({
        high: highs,
        low: lows,
        close: closes,
        volume: volumes,
        period: 14,
      })
      const mfiCurrent = mfi[mfi.length - 1]

      let mfiSignal = "HOLD"
      if (mfiCurrent < 20) mfiSignal = "BUY"
      else if (mfiCurrent > 80) mfiSignal = "SELL"

      results.push({
        name: "MFI",
        value: mfiCurrent?.toFixed(2),
        signal: mfiSignal,
        weight: 2,
      })

      // 12. OBV (On Balance Volume)
      const obv = OBV.calculate({
        close: closes,
        volume: volumes,
      })
      const obvCurrent = obv[obv.length - 1]
      const obvPrevious = obv[obv.length - 2]

      results.push({
        name: "OBV",
        value: obvCurrent?.toFixed(0),
        signal: obvCurrent > obvPrevious ? "BUY" : "SELL",
        weight: 1.5,
      })

      // 13. VWAP (Volume Weighted Average Price)
      const vwap = VWAP.calculate({
        high: highs,
        low: lows,
        close: closes,
        volume: volumes,
      })
      const vwapCurrent = vwap[vwap.length - 1]

      results.push({
        name: "VWAP",
        value: vwapCurrent?.toFixed(4),
        signal: currentPrice > vwapCurrent ? "BUY" : "SELL",
        weight: 2,
      })

      // 14. Parabolic SAR
      const psar = ParabolicSAR.calculate({
        high: highs,
        low: lows,
        step: 0.02,
        max: 0.2,
      })
      const psarCurrent = psar[psar.length - 1]

      results.push({
        name: "ParabolicSAR",
        value: psarCurrent?.toFixed(4),
        signal: currentPrice > psarCurrent ? "BUY" : "SELL",
        weight: 1.5,
      })

      // 15. ATR (Average True Range) - Volatilite için
      const atr = this.calculateATR(highs, lows, closes, 14)
      const atrCurrent = atr[atr.length - 1]

      results.push({
        name: "ATR",
        value: atrCurrent?.toFixed(4),
        signal: "NEUTRAL",
        weight: 0, // Sadece volatilite ölçümü için
      })

      // Güncel fiyatı da ekle
      results.push({
        name: "Price",
        value: currentPrice?.toFixed(4),
        signal: "NEUTRAL",
        weight: 0,
      })

      return results
    } catch (error) {
      console.error("Teknik analiz hatası:", error)
      return []
    }
  }

  calculateATR(highs, lows, closes, period) {
    const trueRanges = []

    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i]
      const tr2 = Math.abs(highs[i] - closes[i - 1])
      const tr3 = Math.abs(lows[i] - closes[i - 1])
      trueRanges.push(Math.max(tr1, tr2, tr3))
    }

    const atr = []
    for (let i = period - 1; i < trueRanges.length; i++) {
      const sum = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      atr.push(sum / period)
    }

    return atr
  }
}
