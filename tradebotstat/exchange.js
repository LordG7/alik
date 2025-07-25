const ccxt = require("ccxt")

class ExchangeManager {
  constructor() {
    this.exchange = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET_KEY,
      sandbox: false, // Set to true for testing
      enableRateLimit: true,
    })
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
      const ticker = await this.exchange.fetchTicker(symbol)
      return ticker.last
    } catch (error) {
      console.error("Error fetching current price:", error)
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
}

module.exports = ExchangeManager
