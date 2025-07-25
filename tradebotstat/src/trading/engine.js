const ccxt = require("ccxt")
const TechnicalAnalysis = require("./indicators")
const logger = require("../utils/logger")
const config = require("../config/config")

class TradingEngine {
  constructor() {
    this.exchange = new ccxt.binance({
      apiKey: config.BINANCE_API_KEY,
      secret: config.BINANCE_SECRET,
      sandbox: config.SANDBOX_MODE,
      enableRateLimit: true,
    })

    this.technicalAnalysis = new TechnicalAnalysis()
    this.activeSignals = new Map()
    this.tradingPairs = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "ADA/USDT", "SOL/USDT"]
    this.timeframes = ["5m", "15m", "1h"]
  }

  async analyzeMarket() {
    const signals = []

    for (const symbol of this.tradingPairs) {
      // Skip if there's already an active signal for this pair
      if (this.activeSignals.has(symbol)) {
        continue
      }

      try {
        const analysis = await this.analyzeSymbol(symbol)
        if (analysis && analysis.strength >= 4) {
          signals.push(analysis)
          this.activeSignals.set(symbol, analysis)
        }
      } catch (error) {
        logger.error(`Error analyzing ${symbol}:`, error)
      }
    }

    return signals
  }

  async analyzeSymbol(symbol) {
    const timeframe = "5m"
    const limit = 100

    try {
      // Fetch OHLCV data
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit)
      const ticker = await this.exchange.fetchTicker(symbol)

      if (!ohlcv || ohlcv.length < 50) {
        return null
      }

      // Prepare data for analysis
      const closes = ohlcv.map((candle) => candle[4])
      const highs = ohlcv.map((candle) => candle[2])
      const lows = ohlcv.map((candle) => candle[3])
      const volumes = ohlcv.map((candle) => candle[5])

      // Run technical analysis
      const indicators = await this.technicalAnalysis.analyze({
        closes,
        highs,
        lows,
        volumes,
        ohlcv,
      })

      // Determine signal direction and strength
      const signal = this.evaluateSignals(indicators, symbol, ticker.last)

      return signal
    } catch (error) {
      logger.error(`Error in symbol analysis for ${symbol}:`, error)
      return null
    }
  }

  evaluateSignals(indicators, symbol, currentPrice) {
    let bullishSignals = 0
    let bearishSignals = 0
    const activeIndicators = []

    // SuperTrend + EMA
    if (indicators.supertrend.trend === "bullish" && indicators.ema.signal === "bullish") {
      bullishSignals++
      activeIndicators.push("SuperTrend + EMA (Bullish)")
    } else if (indicators.supertrend.trend === "bearish" && indicators.ema.signal === "bearish") {
      bearishSignals++
      activeIndicators.push("SuperTrend + EMA (Bearish)")
    }

    // RSI + Stochastic
    if (indicators.rsi.signal === "bullish" && indicators.stochastic.signal === "bullish") {
      bullishSignals++
      activeIndicators.push("RSI + Stochastic (Bullish)")
    } else if (indicators.rsi.signal === "bearish" && indicators.stochastic.signal === "bearish") {
      bearishSignals++
      activeIndicators.push("RSI + Stochastic (Bearish)")
    }

    // CCI
    if (indicators.cci.signal === "bullish") {
      bullishSignals++
      activeIndicators.push("CCI (Bullish)")
    } else if (indicators.cci.signal === "bearish") {
      bearishSignals++
      activeIndicators.push("CCI (Bearish)")
    }

    // VWAP + Fractal
    if (indicators.vwap.signal === "bullish" && indicators.fractal.signal === "bullish") {
      bullishSignals++
      activeIndicators.push("VWAP + Fractal (Bullish)")
    } else if (indicators.vwap.signal === "bearish" && indicators.fractal.signal === "bearish") {
      bearishSignals++
      activeIndicators.push("VWAP + Fractal (Bearish)")
    }

    // ATR + Bollinger Bands
    if (indicators.atr.volatility === "high" && indicators.bb.signal === "bullish") {
      bullishSignals++
      activeIndicators.push("ATR + BB (Bullish)")
    } else if (indicators.atr.volatility === "high" && indicators.bb.signal === "bearish") {
      bearishSignals++
      activeIndicators.push("ATR + BB (Bearish)")
    }

    // Determine signal
    let direction = null
    let strength = 0

    if (bullishSignals >= 4) {
      direction = "BUY"
      strength = bullishSignals
    } else if (bearishSignals >= 4) {
      direction = "SELL"
      strength = bearishSignals
    }

    if (!direction) return null

    // Calculate entry, TP, and SL with 1:1 RR
    const atrValue = indicators.atr.value
    const riskDistance = atrValue * 2 // 2x ATR for risk distance

    let entry, takeProfit, stopLoss

    if (direction === "BUY") {
      entry = currentPrice
      stopLoss = entry - riskDistance
      takeProfit = entry + riskDistance // 1:1 RR
    } else {
      entry = currentPrice
      stopLoss = entry + riskDistance
      takeProfit = entry - riskDistance // 1:1 RR
    }

    return {
      id: Date.now(),
      symbol,
      direction,
      strength,
      entry: entry.toFixed(8),
      takeProfit: takeProfit.toFixed(8),
      stopLoss: stopLoss.toFixed(8),
      timeframe: "5m",
      indicators: activeIndicators,
      timestamp: new Date(),
    }
  }

  async getStatus() {
    return {
      isRunning: true,
      activeSignals: this.activeSignals.size,
      market: "Crypto",
      signalsToday: await this.getSignalsToday(),
      successfulSignals: await this.getSuccessfulSignals(),
      failedSignals: await this.getFailedSignals(),
    }
  }

  async getDailyReport() {
    // This would typically fetch from a database
    return {
      totalSignals: 12,
      successful: 8,
      failed: 4,
      successRate: 66.7,
      bestPair: "BTC/USDT",
      worstPair: "ADA/USDT",
      outlook: "Bullish momentum expected",
    }
  }

  async getSignalsToday() {
    // Implementation would fetch from database
    return 5
  }

  async getSuccessfulSignals() {
    // Implementation would fetch from database
    return 3
  }

  async getFailedSignals() {
    // Implementation would fetch from database
    return 2
  }
}

module.exports = TradingEngine
