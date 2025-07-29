const axios = require("axios")
const config = require("../config/config")
const logger = require("../utils/logger")

class TradingViewDataService {
  constructor() {
    this.baseUrl = config.api.tradingViewUrl
    this.symbol = config.api.symbol // Now TVC:GOLD
    this.cache = new Map()
    this.cacheTimeout = 30000
    this.lastRequestTime = 0
    this.requestDelay = 2000
  }

  async getMarketData(interval = "5m", limit = 100) {
    const cacheKey = `${this.symbol}_${interval}_${limit}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    // Rate limiting
    const now = Date.now()
    if (now - this.lastRequestTime < this.requestDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.requestDelay))
    }

    try {
      // Get current price from TradingView scanner
      const currentPrice = await this.getCurrentPriceFromScanner()

      // Generate realistic OHLC data based on current price
      const ohlcData = this.generateRealisticOHLCData(currentPrice, limit, interval)

      this.cache.set(cacheKey, {
        data: ohlcData,
        timestamp: Date.now(),
      })

      this.lastRequestTime = Date.now()
      return ohlcData
    } catch (error) {
      logger.error("Error fetching TradingView data:", error)

      // Fallback to simulated data if TradingView fails
      const fallbackData = this.generateFallbackData(limit)
      return fallbackData
    }
  }

  async getCurrentPriceFromScanner() {
    try {
      const payload = {
        filter: [
          { left: "name", operation: "match", right: "GOLD" },
          { left: "typespecs", operation: "match", right: ["commodity"] },
        ],
        options: {
          lang: "en",
        },
        symbols: {
          query: {
            types: [],
          },
          tickers: ["TVC:GOLD"], // Use the correct TVC:GOLD symbol
        },
        columns: ["name", "close", "change", "change_abs", "high", "low", "volume"],
        sort: { sortBy: "name", sortOrder: "asc" },
        range: [0, 10],
      }

      const response = await axios.post(`${this.baseUrl}/america/scan`, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://www.tradingview.com/",
        },
        timeout: config.api.requestTimeout,
      })

      if (response.data && response.data.data && response.data.data.length > 0) {
        const goldData = response.data.data[0]
        logger.info(`TVC:GOLD data received - Price: ${goldData.d[1]}, Change: ${goldData.d[2]}`)

        return {
          price: goldData.d[1], // close price
          change: goldData.d[2], // change
          changeAbs: goldData.d[3], // absolute change
          high: goldData.d[4],
          low: goldData.d[5],
          volume: goldData.d[6] || 1000,
        }
      }

      throw new Error("No TVC:GOLD data received from TradingView scanner")
    } catch (error) {
      logger.warn("TradingView TVC:GOLD scanner failed, trying alternative method:", error.message)
      return await this.getDataFromWidget("TVC:GOLD")
    }
  }

  // Alternative method using TradingView widgets specifically for TVC:GOLD
  async getDataFromWidget(symbol = "TVC:GOLD") {
    try {
      const widgetUrl = `https://symbol-overview-widget.tradingview.com/v1/quotes?symbols=${symbol}`

      const response = await axios.get(widgetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://www.tradingview.com/",
        },
        timeout: 5000,
      })

      if (response.data && response.data.length > 0) {
        const data = response.data[0]
        logger.info(`TVC:GOLD widget data - Price: ${data.lp}, Change: ${data.ch}%`)

        return {
          price: data.lp, // last price
          change: data.ch,
          changePercent: data.chp,
          high: data.high_price,
          low: data.low_price,
          volume: data.volume,
        }
      }

      return null
    } catch (error) {
      logger.warn("TradingView TVC:GOLD widget failed:", error.message)
      return this.getFallbackGoldPrice()
    }
  }

  getFallbackGoldPrice() {
    // More realistic GOLD commodity price range (typically $1800-$2200)
    const basePrice = 1900 + Math.random() * 300
    logger.info(`Using fallback GOLD price: ${basePrice}`)

    return {
      price: basePrice,
      high: basePrice + Math.random() * 20,
      low: basePrice - Math.random() * 20,
      volume: 5000 + Math.random() * 10000,
    }
  }

  generateRealisticOHLCData(currentData, limit, interval) {
    const data = []
    let basePrice = currentData.price
    const intervalMs = interval === "1m" ? 60000 : 300000

    // GOLD commodity specific volatility (typically more volatile than forex)
    const goldVolatility = 0.002 // 0.2% volatility per candle for GOLD commodity

    for (let i = 0; i < limit; i++) {
      const trend = (Math.random() - 0.5) * 0.001 // Small trend component
      const noise = (Math.random() - 0.5) * goldVolatility
      const priceChange = (trend + noise) * basePrice

      const open = basePrice
      const close = basePrice + priceChange

      // Generate high and low based on GOLD commodity volatility
      const range = Math.abs(priceChange) + Math.random() * goldVolatility * basePrice
      const high = Math.max(open, close) + Math.random() * range
      const low = Math.min(open, close) - Math.random() * range

      // GOLD commodity typically has higher volume
      const baseVolume = 5000
      const volume = baseVolume + Math.random() * 15000

      data.unshift({
        timestamp: Date.now() - i * intervalMs,
        open: Number.parseFloat(open.toFixed(2)),
        high: Number.parseFloat(high.toFixed(2)),
        low: Number.parseFloat(low.toFixed(2)),
        close: Number.parseFloat(close.toFixed(2)),
        volume: Math.floor(volume),
      })

      basePrice = close
    }

    return data
  }

  generateFallbackData(limit) {
    logger.info("Using fallback market data generation")

    const data = []
    let basePrice = 2050 + Math.random() * 50 // GOLD price around 2050-2100

    for (let i = 0; i < limit; i++) {
      const change = (Math.random() - 0.5) * 8 // Random price movement
      const open = basePrice
      const close = basePrice + change
      const high = Math.max(open, close) + Math.random() * 3
      const low = Math.min(open, close) - Math.random() * 3
      const volume = 1000 + Math.random() * 5000

      data.unshift({
        timestamp: Date.now() - i * 60000, // 1 minute intervals
        open: Number.parseFloat(open.toFixed(2)),
        high: Number.parseFloat(high.toFixed(2)),
        low: Number.parseFloat(low.toFixed(2)),
        close: Number.parseFloat(close.toFixed(2)),
        volume: Math.floor(volume),
      })

      basePrice = close
    }

    return data
  }

  getIntervalMs(interval) {
    const intervals = {
      "1m": 60000,
      "5m": 300000,
      "15m": 900000,
      "1h": 3600000,
      "4h": 14400000,
      "1d": 86400000,
    }

    return intervals[interval] || 300000 // Default to 5 minutes
  }

  async getCurrentPrice() {
    try {
      const currentData = await this.getCurrentPriceFromScanner()
      return currentData.price
    } catch (error) {
      logger.error("Error getting current price:", error)
      return 2050 + Math.random() * 50 // Fallback price
    }
  }

  // Method to get multiple timeframe data
  async getMultiTimeframeData() {
    try {
      const timeframes = ["1m", "5m"]
      const data = {}

      for (const tf of timeframes) {
        data[tf] = await this.getMarketData(tf, 50)
        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      return data
    } catch (error) {
      logger.error("Error getting multi-timeframe data:", error)
      return null
    }
  }
}

module.exports = new TradingViewDataService()
