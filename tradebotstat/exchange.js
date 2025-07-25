const ccxt = require("ccxt")

class ExchangeManager {
  constructor() {
    this.exchange = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET_KEY,
      sandbox: false,
      enableRateLimit: true,
    })

    // Add price cache to reduce API calls
    this.priceCache = new Map()
    this.cacheTimeout = 5000 // 5 seconds cache
  }

  async getCandles(symbol, timeframe, limit = 100) {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit)
      return ohlcv.map((candle) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }))
    } catch (error) {
      console.error("Error fetching candles:", error)
      return null
    }
  }

  async getCurrentPrice(symbol) {
    try {
      // Check cache first
      const cached = this.priceCache.get(symbol)
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.price
      }

      const ticker = await this.exchange.fetchTicker(symbol)

      // Update cache
      this.priceCache.set(symbol, {
        price: ticker.last,
        timestamp: Date.now(),
      })

      return ticker.last
    } catch (error) {
      console.error(`Error fetching current price for ${symbol}:`, error)
      return null
    }
  }

  async getBalance() {
    try {
      return await this.exchange.fetchBalance()
    } catch (error) {
      console.error("Error fetching balance:", error)
      return null
    }
  }

  // For actual trading (optional)
  async createOrder(symbol, type, side, amount, price = null) {
    try {
      return await this.exchange.createOrder(symbol, type, side, amount, price)
    } catch (error) {
      console.error("Error creating order:", error)
      return null
    }
  }

  // Add method to get multiple prices at once
  async getMultiplePrices(symbols) {
    try {
      const tickers = await this.exchange.fetchTickers(symbols)
      const prices = {}

      for (const symbol of symbols) {
        if (tickers[symbol]) {
          prices[symbol] = tickers[symbol].last
          // Update cache
          this.priceCache.set(symbol, {
            price: tickers[symbol].last,
            timestamp: Date.now(),
          })
        }
      }

      return prices
    } catch (error) {
      console.error("Error fetching multiple prices:", error)
      return {}
    }
  }
}

module.exports = ExchangeManager
