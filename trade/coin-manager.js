class CoinManager {
  constructor(binanceClient) {
    this.binance = binanceClient
    // Fixed list of coins as specified
    this.fixedCoins = [
      "BTCUSDT",
      "ETHUSDT",
      "ROSEUSDT",
      "INJUSDT",
      "BNBUSDT",
      "SOLUSDT",
      "PEPEUSDT",
      "XRPUSDT",
      "SUIUSDT",
      "DOGEUSDT",
    ]
    this.lastUpdate = 0
    this.updateInterval = 300000 // 5 minutes
  }

  async getAvailableCoins() {
    // Return the fixed list of coins
    return this.fixedCoins
  }

  async updateVolatileCoinsIfNeeded() {
    // No need to update since we're using a fixed list
    // But we can still update stats for display purposes
    const now = Date.now()
    if (now - this.lastUpdate > this.updateInterval) {
      await this.updateCoinStats()
      this.lastUpdate = now
    }
  }

  async updateVolatileCoins() {
    // Keep this method for compatibility but use fixed coins
    console.log("🔄 Using fixed coin list...")
    console.log("✅ Fixed coins:", this.fixedCoins.join(", "))
  }

  async updateCoinStats() {
    try {
      console.log("🔄 Updating coin statistics...")
      const coinStats = await this.getCoinStats(this.fixedCoins)

      const statsDisplay = this.fixedCoins
        .map((coin) => {
          const stats = coinStats[coin]
          const changeText = stats ? `${stats.change24h.toFixed(2)}%` : "N/A"
          return `${coin}: ${changeText}`
        })
        .join(", ")

      console.log("✅ Updated coin stats:", statsDisplay)
    } catch (error) {
      console.error("❌ Error updating coin stats:", error)
    }
  }

  isValidTradingPair(coin) {
    // Check if coin is in our fixed list
    return this.fixedCoins.includes(coin.symbol)
  }

  getCoinInfo(symbol) {
    return {
      symbol,
      isFixed: this.fixedCoins.includes(symbol),
      isInjusdt: symbol === "INJUSDT",
    }
  }

  async getCoinStats(symbols) {
    try {
      const ticker24hr = await this.binance.dailyStats()
      const stats = {}

      for (const symbol of symbols) {
        const coinData = ticker24hr.find((coin) => coin.symbol === symbol)
        if (coinData) {
          stats[symbol] = {
            price: Number.parseFloat(coinData.lastPrice),
            change24h: Number.parseFloat(coinData.priceChangePercent),
            volume24h: Number.parseFloat(coinData.volume),
            high24h: Number.parseFloat(coinData.highPrice),
            low24h: Number.parseFloat(coinData.lowPrice),
          }
        }
      }

      return stats
    } catch (error) {
      console.error("Error fetching coin stats:", error)
      return {}
    }
  }
}

module.exports = CoinManager
