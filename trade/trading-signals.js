class TradingSignals {
  constructor(technicalAnalysis) {
    this.ta = technicalAnalysis
  }

  async generateSignal(symbol) {
    try {
      const indicators = await this.ta.getAllIndicators(symbol)
      const klines = await this.ta.getKlines(symbol, "5m", 1)
      const currentPrice = klines[0].close

      // Analyze all indicators
      const signals = [
        indicators.superTrend.signal,
        indicators.emaRsi.signal,
        indicators.stochastic.signal,
        indicators.cci.signal,
        indicators.vwapBB.signal,
      ]

      // Count buy/sell signals
      const buySignals = signals.filter((s) => s === "BUY").length
      const sellSignals = signals.filter((s) => s === "SELL").length

      // Determine overall signal strength
      const totalSignals = buySignals + sellSignals
      if (totalSignals < 3) return null // Not enough confirmation

      let signalType, confidence

      if (buySignals >= 3) {
        signalType = "LONG"
        confidence = Math.round((buySignals / 5) * 100)
      } else if (sellSignals >= 3) {
        signalType = "SHORT"
        confidence = Math.round((sellSignals / 5) * 100)
      } else {
        return null // Mixed signals
      }

      // Calculate entry, stop loss, and take profit levels
      const atr = await this.calculateATR(symbol)
      const entryLevels = this.calculateEntryLevels(currentPrice, signalType, atr)
      const stopLoss = this.calculateStopLoss(currentPrice, signalType, atr)
      const takeProfits = this.calculateTakeProfits(currentPrice, signalType, atr)

      return {
        symbol: symbol,
        type: signalType,
        price: currentPrice.toFixed(4),
        timeframe: "5m",
        entries: entryLevels,
        stopLoss: stopLoss.toFixed(4),
        takeProfits: takeProfits.map((tp) => tp.toFixed(4)),
        confidence: confidence,
        timestamp: new Date().toISOString(),
        indicators: {
          supertrend: indicators.superTrend.signal,
          rsi: indicators.emaRsi.rsi.toFixed(2),
          stochastic: `${indicators.stochastic.k.toFixed(2)}/${indicators.stochastic.d.toFixed(2)}`,
          cci: indicators.cci.value.toFixed(2),
        },
      }
    } catch (error) {
      console.error(`Error generating signal for ${symbol}:`, error)
      return null
    }
  }

  async calculateATR(symbol) {
    const klines = await this.ta.getKlines(symbol, "5m", 20)
    const highs = klines.map((k) => k.high)
    const lows = klines.map((k) => k.low)
    const closes = klines.map((k) => k.close)

    let atrSum = 0
    for (let i = 1; i < klines.length; i++) {
      const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]))
      atrSum += tr
    }

    return atrSum / (klines.length - 1)
  }

  calculateEntryLevels(price, signalType, atr) {
    const entries = []
    const offset = atr * 0.5

    if (signalType === "LONG") {
      entries.push(price)
      entries.push(price - offset)
    } else {
      entries.push(price)
      entries.push(price + offset)
    }

    return entries.map((entry) => entry.toFixed(4))
  }

  calculateStopLoss(price, signalType, atr) {
    const stopDistance = atr * 2

    if (signalType === "LONG") {
      return price - stopDistance
    } else {
      return price + stopDistance
    }
  }

  calculateTakeProfits(price, signalType, atr) {
    const takeProfits = []
    const tpDistance1 = atr * 1.5
    const tpDistance2 = atr * 3
    const tpDistance3 = atr * 4.5

    if (signalType === "LONG") {
      takeProfits.push(price + tpDistance1)
      takeProfits.push(price + tpDistance2)
      takeProfits.push(price + tpDistance3)
    } else {
      takeProfits.push(price - tpDistance1)
      takeProfits.push(price - tpDistance2)
      takeProfits.push(price - tpDistance3)
    }

    return takeProfits
  }

  async checkCloseSignal(symbol, currentPosition) {
    const indicators = await this.ta.getAllIndicators(symbol)

    // Check for reversal signals
    const reversalSignals = []

    if (currentPosition.side === "LONG") {
      if (indicators.superTrend.signal === "SELL") reversalSignals.push("SuperTrend")
      if (indicators.emaRsi.rsi > 70) reversalSignals.push("RSI Overbought")
      if (indicators.stochastic.signal === "SELL") reversalSignals.push("Stochastic")
    } else {
      if (indicators.superTrend.signal === "BUY") reversalSignals.push("SuperTrend")
      if (indicators.emaRsi.rsi < 30) reversalSignals.push("RSI Oversold")
      if (indicators.stochastic.signal === "BUY") reversalSignals.push("Stochastic")
    }

    if (reversalSignals.length >= 2) {
      return {
        type: "CLOSE",
        symbol: symbol,
        reason: reversalSignals.join(", "),
        confidence: Math.round((reversalSignals.length / 3) * 100),
      }
    }

    return null
  }
}

module.exports = TradingSignals
