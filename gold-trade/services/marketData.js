const axios = require("axios")
const config = require("../config/config")
const logger = require("../utils/logger")

class MarketDataService {
  constructor() {
    this.baseUrl = config.api.baseUrl
    this.apiKey = config.api.key
    this.cache = new Map()
    this.cacheTimeout = 30000 // 30 seconds
  }

  async getOHLCData(symbol, timeframe, limit = 100) {
    const cacheKey = `${symbol}_${timeframe}_${limit}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    try {
      // Simulated OHLC data for GOLD - replace with real API
      const data = this.generateSimulatedData(limit)

      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      })

      return data
    } catch (error) {
      logger.error("Error fetching market data:", error)
      throw error
    }
  }

  generateSimulatedData(limit) {
    const data = []
    let basePrice = 2000 + Math.random() * 100 // GOLD price around 2000-2100

    for (let i = 0; i < limit; i++) {
      const change = (Math.random() - 0.5) * 10 // Random price movement
      const open = basePrice
      const close = basePrice + change
      const high = Math.max(open, close) + Math.random() * 5
      const low = Math.min(open, close) - Math.random() * 5
      const volume = 1000 + Math.random() * 5000

      data.unshift({
        timestamp: Date.now() - i * 60000, // 1 minute intervals
        open,
        high,
        low,
        close,
        volume,
      })

      basePrice = close
    }

    return data
  }

  async getCurrentPrice(symbol) {
    try {
      const data = await this.getOHLCData(symbol, "1m", 1)
      return data[0].close
    } catch (error) {
      logger.error("Error getting current price:", error)
      return null
    }
  }
}

module.exports = new MarketDataService()
