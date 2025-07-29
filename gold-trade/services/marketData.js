const tradingViewData = require("./tradingViewData")
const logger = require("../utils/logger")

class MarketDataService {
  constructor() {
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
      // Use TradingView data service
      const data = await tradingViewData.getMarketData(timeframe, limit)

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

  async getCurrentPrice(symbol) {
    try {
      return await tradingViewData.getCurrentPrice()
    } catch (error) {
      logger.error("Error getting current price:", error)
      return null
    }
  }

  async getMultiTimeframeAnalysis() {
    try {
      return await tradingViewData.getMultiTimeframeData()
    } catch (error) {
      logger.error("Error getting multi-timeframe data:", error)
      return null
    }
  }
}

module.exports = new MarketDataService()
