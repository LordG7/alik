const {
  RSI,
  MACD,
  BollingerBands,
  StochasticRSI,
  EMA,
  SMA,
  ATR,
  CCI,
  MFI,
  WilliamsR,
  ADX,
  PSAR,
  OBV,
} = require("technicalindicators")

class TechnicalAnalysis {
  constructor() {
    this.indicators = {}
  }

  async analyze(klines, currentPrice) {
    const closes = klines.map((k) => k.close)
    const highs = klines.map((k) => k.high)
    const lows = klines.map((k) => k.low)
    const volumes = klines.map((k) => k.volume)
    const opens = klines.map((k) => k.open)

    // 14 güçlü indikatör hesapla (Ichimoku kaldırıldı)
    const analysis = {
      rsi: this.calculateRSI(closes),
      macd: this.calculateMACD(closes),
      bollinger: this.calculateBollingerBands(closes),
      stochRSI: this.calculateStochasticRSI(closes),
      ema: this.calculateEMA(closes),
      sma: this.calculateSMA(closes),
      atr: this.calculateATR(highs, lows, closes),
      cci: this.calculateCCI(highs, lows, closes),
      mfi: this.calculateMFI(highs, lows, closes, volumes),
      williams: this.calculateWilliams(highs, lows, closes),
      adx: this.calculateADX(highs, lows, closes),
      psar: this.calculatePSAR(highs, lows),
      obv: this.calculateOBV(closes, volumes),
      volatility: this.calculateVolatility(closes),
    }

    return this.evaluateSignals(analysis, currentPrice)
  }

  calculateRSI(closes) {
    try {
      const rsiValues = RSI.calculate({ values: closes, period: 14 })
      return rsiValues[rsiValues.length - 1] || 50
    } catch (error) {
      console.log("RSI hesaplama hatası:", error.message)
      return 50
    }
  }

  calculateMACD(closes) {
    try {
      const macdValues = MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      })

      const latest = macdValues[macdValues.length - 1]
      if (!latest) return { macd: 0, signal: 0, histogram: 0 }

      return {
        macd: latest.MACD,
        signal: latest.signal,
        histogram: latest.histogram,
      }
    } catch (error) {
      console.log("MACD hesaplama hatası:", error.message)
      return { macd: 0, signal: 0, histogram: 0 }
    }
  }

  calculateBollingerBands(closes) {
    try {
      const bbValues = BollingerBands.calculate({
        values: closes,
        period: 20,
        stdDev: 2,
      })

      const latest = bbValues[bbValues.length - 1]
      if (!latest) return { upper: 0, middle: 0, lower: 0 }

      return {
        upper: latest.upper,
        middle: latest.middle,
        lower: latest.lower,
      }
    } catch (error) {
      console.log("Bollinger Bands hesaplama hatası:", error.message)
      return { upper: 0, middle: 0, lower: 0 }
    }
  }

  calculateStochasticRSI(closes) {
    try {
      const stochRSIValues = StochasticRSI.calculate({
        values: closes,
        rsiPeriod: 14,
        stochasticPeriod: 14,
        kPeriod: 3,
        dPeriod: 3,
      })

      const latest = stochRSIValues[stochRSIValues.length - 1]
      if (!latest) return { k: 50, d: 50 }

      return {
        k: latest.k,
        d: latest.d,
      }
    } catch (error) {
      console.log("Stochastic RSI hesaplama hatası:", error.message)
      return { k: 50, d: 50 }
    }
  }

  calculateEMA(closes) {
    try {
      const ema20 = EMA.calculate({ values: closes, period: 20 })
      const ema50 = EMA.calculate({ values: closes, period: 50 })

      return {
        ema20: ema20[ema20.length - 1] || closes[closes.length - 1],
        ema50: ema50[ema50.length - 1] || closes[closes.length - 1],
      }
    } catch (error) {
      console.log("EMA hesaplama hatası:", error.message)
      return {
        ema20: closes[closes.length - 1],
        ema50: closes[closes.length - 1],
      }
    }
  }

  calculateSMA(closes) {
    try {
      const sma20 = SMA.calculate({ values: closes, period: 20 })
      const sma50 = SMA.calculate({ values: closes, period: 50 })

      return {
        sma20: sma20[sma20.length - 1] || closes[closes.length - 1],
        sma50: sma50[sma50.length - 1] || closes[closes.length - 1],
      }
    } catch (error) {
      console.log("SMA hesaplama hatası:", error.message)
      return {
        sma20: closes[closes.length - 1],
        sma50: closes[closes.length - 1],
      }
    }
  }

  calculateATR(highs, lows, closes) {
    try {
      const atrValues = ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      })

      return atrValues[atrValues.length - 1] || 0
    } catch (error) {
      console.log("ATR hesaplama hatası:", error.message)
      return 0
    }
  }

  calculateCCI(highs, lows, closes) {
    try {
      const cciValues = CCI.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 20,
      })

      return cciValues[cciValues.length - 1] || 0
    } catch (error) {
      console.log("CCI hesaplama hatası:", error.message)
      return 0
    }
  }

  calculateMFI(highs, lows, closes, volumes) {
    try {
      const mfiValues = MFI.calculate({
        high: highs,
        low: lows,
        close: closes,
        volume: volumes,
        period: 14,
      })

      return mfiValues[mfiValues.length - 1] || 50
    } catch (error) {
      console.log("MFI hesaplama hatası:", error.message)
      return 50
    }
  }

  calculateWilliams(highs, lows, closes) {
    try {
      const williamsValues = WilliamsR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      })

      return williamsValues[williamsValues.length - 1] || -50
    } catch (error) {
      console.log("Williams %R hesaplama hatası:", error.message)
      return -50
    }
  }

  calculateADX(highs, lows, closes) {
    try {
      const adxValues = ADX.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      })

      const latest = adxValues[adxValues.length - 1]
      if (!latest) return { adx: 25, pdi: 25, mdi: 25 }

      return {
        adx: latest.adx,
        pdi: latest.pdi,
        mdi: latest.mdi,
      }
    } catch (error) {
      console.log("ADX hesaplama hatası:", error.message)
      return { adx: 25, pdi: 25, mdi: 25 }
    }
  }

  calculatePSAR(highs, lows) {
    try {
      const psarValues = PSAR.calculate({
        high: highs,
        low: lows,
        step: 0.02,
        max: 0.2,
      })

      return psarValues[psarValues.length - 1] || 0
    } catch (error) {
      console.log("PSAR hesaplama hatası:", error.message)
      return 0
    }
  }

  calculateOBV(closes, volumes) {
    try {
      const obvValues = OBV.calculate({
        close: closes,
        volume: volumes,
      })

      return obvValues[obvValues.length - 1] || 0
    } catch (error) {
      console.log("OBV hesaplama hatası:", error.message)
      return 0
    }
  }

  calculateVolatility(closes) {
    try {
      if (closes.length < 20) return 0

      const returns = []
      for (let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1])
      }

      const mean = returns.reduce((a, b) => a + b, 0) / returns.length
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length

      return Math.sqrt(variance)
    } catch (error) {
      console.log("Volatilite hesaplama hatası:", error.message)
      return 0
    }
  }

  evaluateSignals(analysis, currentPrice) {
    const signals = {
      rsi: analysis.rsi,
      macdSignal: this.getMACDSignal(analysis.macd),
      bollingerSignal: this.getBollingerSignal(analysis.bollinger, currentPrice),
      stochSignal: this.getStochasticSignal(analysis.stochRSI),
      emaSignal: this.getEMASignal(analysis.ema, currentPrice),
      smaSignal: this.getSMASignal(analysis.sma, currentPrice),
      cciSignal: this.getCCISignal(analysis.cci),
      mfiSignal: this.getMFISignal(analysis.mfi),
      williamsSignal: this.getWilliamsSignal(analysis.williams),
      adxSignal: this.getADXSignal(analysis.adx),
      psarSignal: this.getPSARSignal(analysis.psar, currentPrice),
      obvSignal: this.getOBVSignal(analysis.obv),
      volatility: analysis.volatility,
      atr: analysis.atr,
    }

    return signals
  }

  getMACDSignal(macd) {
    if (macd.macd > macd.signal && macd.histogram > 0) return "BUY"
    if (macd.macd < macd.signal && macd.histogram < 0) return "SELL"
    return "HOLD"
  }

  getBollingerSignal(bb, price) {
    if (price <= bb.lower) return "BUY"
    if (price >= bb.upper) return "SELL"
    return "HOLD"
  }

  getStochasticSignal(stoch) {
    if (stoch.k < 20 && stoch.d < 20) return "BUY"
    if (stoch.k > 80 && stoch.d > 80) return "SELL"
    return "HOLD"
  }

  getEMASignal(ema, price) {
    if (price > ema.ema20 && ema.ema20 > ema.ema50) return "BUY"
    if (price < ema.ema20 && ema.ema20 < ema.ema50) return "SELL"
    return "HOLD"
  }

  getSMASignal(sma, price) {
    if (price > sma.sma20 && sma.sma20 > sma.sma50) return "BUY"
    if (price < sma.sma20 && sma.sma20 < sma.sma50) return "SELL"
    return "HOLD"
  }

  getCCISignal(cci) {
    if (cci < -100) return "BUY"
    if (cci > 100) return "SELL"
    return "HOLD"
  }

  getMFISignal(mfi) {
    if (mfi < 20) return "BUY"
    if (mfi > 80) return "SELL"
    return "HOLD"
  }

  getWilliamsSignal(williams) {
    if (williams < -80) return "BUY"
    if (williams > -20) return "SELL"
    return "HOLD"
  }

  getADXSignal(adx) {
    if (adx.adx > 25 && adx.pdi > adx.mdi) return "BUY"
    if (adx.adx > 25 && adx.mdi > adx.pdi) return "SELL"
    return "HOLD"
  }

  getPSARSignal(psar, price) {
    if (price > psar) return "BUY"
    if (price < psar) return "SELL"
    return "HOLD"
  }

  getOBVSignal(obv) {
    // OBV trend analizi için basit bir yaklaşım
    return "HOLD" // Daha karmaşık trend analizi gerekir
  }
}

module.exports = TechnicalAnalysis
