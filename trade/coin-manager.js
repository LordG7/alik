class CoinManager {
  constructor(binanceClient) {
    this.binance = binanceClient
    this.volatileCoins = []
    this.lastUpdate = 0
    this.updateInterval = 300000 // 5 minutes
  }

  async getAvailableCoins() {
    await this.updateVolatileCoinsIfNeeded()
    return ["INJUSDT", ...this.volatileCoins]
  }

  async updateVolatileCoinsIfNeeded() {
    const now = Date.now()
    if (now - this.lastUpdate > this.updateInterval) {
      await this.updateVolatileCoins()
      this.lastUpdate = now
    }
  }

  async updateVolatileCoins() {
    try {
      console.log("🔄 Updating volatile coins list...")

      const ticker24hr = await this.binance.dailyStats()

      // Filter and sort coins by volatility
      const filteredCoins = ticker24hr
        .filter((coin) => this.isValidTradingPair(coin))
        .map((coin) => ({
          symbol: coin.symbol,
          priceChange: Number.parseFloat(coin.priceChangePercent),
          volume: Number.parseFloat(coin.volume),
          volatility: Math.abs(Number.parseFloat(coin.priceChangePercent)),
        }))
        .sort((a, b) => {
          // Sort by volatility first, then by volume
          if (Math.abs(b.volatility - a.volatility) < 1) {
            return b.volume - a.volume
          }
          return b.volatility - a.volatility
        })
        .slice(0, 9)
        .map((coin) => coin.symbol)

      this.volatileCoins = filteredCoins

      console.log(
        "✅ Updated volatile coins:",
        this.volatileCoins
          .map((coin) => `${coin} (${ticker24hr.find((t) => t.symbol === coin)?.priceChangePercent}%)`)
          .join(", "),
      )
    } catch (error) {
      console.error("❌ Error updating volatile coins:", error)
      // Fallback to popular coins
      this.volatileCoins = [
        "BTCUSDT",
        "ETHUSDT",
        "BNBUSDT",
        "ADAUSDT",
        "XRPUSDT",
        "SOLUSDT",
        "DOTUSDT",
        "DOGEUSDT",
        "AVAXUSDT",
      ]
    }
  }

  isValidTradingPair(coin) {
    return (
      coin.symbol.endsWith("USDT") &&
      !coin.symbol.includes("UP") &&
      !coin.symbol.includes("DOWN") &&
      !coin.symbol.includes("BULL") &&
      !coin.symbol.includes("BEAR") &&
      coin.symbol !== "INJUSDT" && // Exclude INJUSDT as it's always included
      Number.parseFloat(coin.volume) > 1000000 && // Minimum volume filter
      Number.parseFloat(coin.count) > 1000 // Minimum trade count
    )
  }

  getCoinInfo(symbol) {
    return {
      symbol,
      isVolatile: this.volatileCoins.includes(symbol),
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
