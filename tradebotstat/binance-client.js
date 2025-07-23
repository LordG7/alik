const Binance = require("binance-api-node").default

class BinanceClient {
  constructor() {
    this.client = Binance({
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_SECRET_KEY,
      test: false, // Gerçek API kullan
    })
  }

  async getKlines(symbol, interval, limit = 500) {
    try {
      const klines = await this.client.candles({
        symbol: symbol,
        interval: interval,
        limit: limit,
      })

      return klines.map((kline) => ({
        openTime: kline.openTime,
        open: Number.parseFloat(kline.open),
        high: Number.parseFloat(kline.high),
        low: Number.parseFloat(kline.low),
        close: Number.parseFloat(kline.close),
        volume: Number.parseFloat(kline.volume),
        closeTime: kline.closeTime,
      }))
    } catch (error) {
      console.error("Binance Klines hatası:", error)
      throw error
    }
  }

  async getCurrentPrice(symbol) {
    try {
      const ticker = await this.client.prices({ symbol: symbol })
      return Number.parseFloat(ticker[symbol])
    } catch (error) {
      console.error("Binance Price hatası:", error)
      throw error
    }
  }

  async get24hrStats(symbol) {
    try {
      const stats = await this.client.dailyStats({ symbol: symbol })
      return {
        priceChange: Number.parseFloat(stats.priceChange),
        priceChangePercent: Number.parseFloat(stats.priceChangePercent),
        volume: Number.parseFloat(stats.volume),
        high: Number.parseFloat(stats.highPrice),
        low: Number.parseFloat(stats.lowPrice),
      }
    } catch (error) {
      console.error("Binance Stats hatası:", error)
      throw error
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const orderBook = await this.client.book({ symbol: symbol, limit: limit })
      return {
        bids: orderBook.bids.map((bid) => ({
          price: Number.parseFloat(bid.price),
          quantity: Number.parseFloat(bid.quantity),
        })),
        asks: orderBook.asks.map((ask) => ({
          price: Number.parseFloat(ask.price),
          quantity: Number.parseFloat(ask.quantity),
        })),
      }
    } catch (error) {
      console.error("Binance OrderBook hatası:", error)
      throw error
    }
  }
}

module.exports = BinanceClient
