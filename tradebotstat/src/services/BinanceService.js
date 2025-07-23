import Binance from "binance-api-node"
import { Logger } from "../utils/Logger.js"

export class BinanceService {
  constructor() {
    this.client = Binance({
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_API_SECRET,
      useServerTime: true,
    })
    this.logger = new Logger()
  }

  async getMarketData(symbol, interval = "15m", limit = 100) {
    try {
      // Kline verilerini al
      const klines = await this.client.candles({
        symbol,
        interval,
        limit,
      })

      // 24 saatlik ticker bilgisi
      const ticker = await this.client.dailyStats({ symbol })

      // Market derinliği
      const depth = await this.client.book({ symbol, limit: 10 })

      // Verileri işle
      const closes = klines.map((k) => Number.parseFloat(k.close))
      const highs = klines.map((k) => Number.parseFloat(k.high))
      const lows = klines.map((k) => Number.parseFloat(k.low))
      const opens = klines.map((k) => Number.parseFloat(k.open))
      const volumes = klines.map((k) => Number.parseFloat(k.volume))
      const timestamps = klines.map((k) => k.openTime)

      return {
        symbol,
        currentPrice: Number.parseFloat(ticker.lastPrice),
        priceChange24h: Number.parseFloat(ticker.priceChangePercent),
        volume: Number.parseFloat(ticker.volume),
        high24h: Number.parseFloat(ticker.highPrice),
        low24h: Number.parseFloat(ticker.lowPrice),
        prices: closes,
        closes,
        highs,
        lows,
        opens,
        volumes,
        timestamps,
        bidPrice: Number.parseFloat(depth.bids[0].price),
        askPrice: Number.parseFloat(depth.asks[0].price),
        spread: Number.parseFloat(depth.asks[0].price) - Number.parseFloat(depth.bids[0].price),
      }
    } catch (error) {
      this.logger.error(`Binance veri alma hatası (${symbol}):`, error)
      throw error
    }
  }

  async getAccountInfo() {
    try {
      return await this.client.accountInfo()
    } catch (error) {
      this.logger.error("Hesap bilgisi alma hatası:", error)
      throw error
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      return await this.client.book({ symbol, limit })
    } catch (error) {
      this.logger.error(`Order book alma hatası (${symbol}):`, error)
      throw error
    }
  }

  async getTrades(symbol, limit = 100) {
    try {
      return await this.client.trades({ symbol, limit })
    } catch (error) {
      this.logger.error(`İşlem geçmişi alma hatası (${symbol}):`, error)
      throw error
    }
  }
}
