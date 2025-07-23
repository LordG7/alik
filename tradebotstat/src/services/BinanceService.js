import pkg from "binance-api-node"
import { Logger } from "../utils/Logger.js"

// CommonJS modülünden default export'u çıkar
const Binance = pkg.default || pkg

export class BinanceService {
  constructor() {
    this.client = Binance({
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_API_SECRET,
      useServerTime: true,
    })
    this.logger = new Logger()
  }

  async getMarketData(symbol, interval = "15m", limit = 50) {
    try {
      this.logger.info(`📊 Market verisi alınıyor: ${symbol}`)

      // Kline verilerini al
      const klines = await this.client.candles({
        symbol,
        interval,
        limit,
      })

      // 24 saatlik ticker bilgisi
      const ticker = await this.client.dailyStats({ symbol })

      // Market derinliği (opsiyonel)
      let depth = null
      try {
        depth = await this.client.book({ symbol, limit: 5 })
      } catch (depthError) {
        this.logger.warn("Market derinliği alınamadı:", depthError.message)
      }

      // Verileri işle
      const closes = klines.map((k) => Number.parseFloat(k.close))
      const highs = klines.map((k) => Number.parseFloat(k.high))
      const lows = klines.map((k) => Number.parseFloat(k.low))
      const opens = klines.map((k) => Number.parseFloat(k.open))
      const volumes = klines.map((k) => Number.parseFloat(k.volume))
      const timestamps = klines.map((k) => k.openTime)

      // Ortalama volume hesapla
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length

      const result = {
        symbol,
        currentPrice: Number.parseFloat(ticker.lastPrice),
        priceChange24h: Number.parseFloat(ticker.priceChangePercent),
        volume: Number.parseFloat(ticker.volume),
        high24h: Number.parseFloat(ticker.highPrice),
        low24h: Number.parseFloat(ticker.lowPrice),
        avgVolume,
        prices: closes,
        closes,
        highs,
        lows,
        opens,
        volumes,
        timestamps,
      }

      // Market derinliği varsa ekle
      if (depth) {
        result.bidPrice = Number.parseFloat(depth.bids[0]?.price || ticker.lastPrice)
        result.askPrice = Number.parseFloat(depth.asks[0]?.price || ticker.lastPrice)
        result.spread = result.askPrice - result.bidPrice
      }

      this.logger.info(`✅ Market verisi alındı: ${symbol} - $${result.currentPrice}`)
      return result
    } catch (error) {
      this.logger.error(`❌ Binance veri alma hatası (${symbol}):`, error)

      // Hata durumunda mock data döndür (geliştirme için)
      if (process.env.NODE_ENV === "development") {
        return this.getMockMarketData(symbol)
      }

      throw error
    }
  }

  // Geliştirme ve test için mock data
  getMockMarketData(symbol) {
    const basePrice = 25.5 // INJ için örnek fiyat
    const mockData = {
      symbol,
      currentPrice: basePrice + (Math.random() - 0.5) * 2,
      priceChange24h: (Math.random() - 0.5) * 10,
      volume: 1000000 + Math.random() * 500000,
      high24h: basePrice + Math.random() * 3,
      low24h: basePrice - Math.random() * 3,
      avgVolume: 1200000,
      closes: [],
      highs: [],
      lows: [],
      opens: [],
      volumes: [],
      timestamps: [],
    }

    // 50 adet mock kline data oluştur
    for (let i = 0; i < 50; i++) {
      const price = basePrice + (Math.random() - 0.5) * 5
      const high = price + Math.random() * 0.5
      const low = price - Math.random() * 0.5
      const volume = 10000 + Math.random() * 50000

      mockData.closes.push(price)
      mockData.highs.push(high)
      mockData.lows.push(low)
      mockData.opens.push(price + (Math.random() - 0.5) * 0.2)
      mockData.volumes.push(volume)
      mockData.timestamps.push(Date.now() - (50 - i) * 15 * 60 * 1000) // 15 dakika intervals
    }

    mockData.prices = mockData.closes
    this.logger.warn(`⚠️ Mock data kullanılıyor: ${symbol}`)
    return mockData
  }

  async getAccountInfo() {
    try {
      const account = await this.client.accountInfo()
      this.logger.info("✅ Hesap bilgisi alındı")
      return account
    } catch (error) {
      this.logger.error("❌ Hesap bilgisi alma hatası:", error)
      throw error
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const orderBook = await this.client.book({ symbol, limit })
      this.logger.info(`✅ Order book alındı: ${symbol}`)
      return orderBook
    } catch (error) {
      this.logger.error(`❌ Order book alma hatası (${symbol}):`, error)
      throw error
    }
  }

  async getTrades(symbol, limit = 100) {
    try {
      const trades = await this.client.trades({ symbol, limit })
      this.logger.info(`✅ İşlem geçmişi alındı: ${symbol}`)
      return trades
    } catch (error) {
      this.logger.error(`❌ İşlem geçmişi alma hatası (${symbol}):`, error)
      throw error
    }
  }

  // Bağlantı testi
  async testConnection() {
    try {
      const serverTime = await this.client.time()
      this.logger.info(`✅ Binance bağlantısı başarılı - Server time: ${new Date(serverTime.serverTime)}`)
      return true
    } catch (error) {
      this.logger.error("❌ Binance bağlantı testi başarısız:", error)
      return false
    }
  }

  // API limitleri kontrol et
  async checkApiLimits() {
    try {
      const exchangeInfo = await this.client.exchangeInfo()
      this.logger.info("✅ API limit bilgisi alındı")
      return exchangeInfo.rateLimits
    } catch (error) {
      this.logger.error("❌ API limit kontrolü başarısız:", error)
      return null
    }
  }
}
