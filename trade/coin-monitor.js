const cron = require("node-cron")

class CoinMonitor {
  constructor(coinManager, bot) {
    this.coinManager = coinManager
    this.bot = bot
    this.setupCronJobs()
  }

  setupCronJobs() {
    // Update volatile coins every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      await this.coinManager.updateVolatileCoins()
    })

    // Send daily coin summary at 9 AM
    cron.schedule("0 9 * * *", async () => {
      await this.sendDailyCoinSummary()
    })
  }

  async sendDailyCoinSummary() {
    try {
      const availableCoins = await this.coinManager.getAvailableCoins()
      const coinStats = await this.coinManager.getCoinStats(availableCoins)

      let summary = "📊 *Daily Coin Summary*\n\n"
      summary += "*Top Volatile Coins (24h):*\n"

      const sortedCoins = Object.entries(coinStats)
        .sort(([, a], [, b]) => Math.abs(b.change24h) - Math.abs(a.change24h))
        .slice(0, 10)

      for (const [symbol, stats] of sortedCoins) {
        const emoji = stats.change24h > 0 ? "🟢" : "🔴"
        summary += `${emoji} *${symbol}*: ${stats.change24h.toFixed(2)}% | $${stats.price.toFixed(4)}\n`
      }

      summary += "\n💡 *Tip*: High volatility coins offer more trading opportunities but also higher risk!"

      // Send to all active users (you might want to make this opt-in)
      // For now, we'll just log it
      console.log("Daily coin summary:", summary)
    } catch (error) {
      console.error("Error sending daily coin summary:", error)
    }
  }

  async notifyVolatilitySpike(symbol, changePercent) {
    const message = `
🚨 *Volatility Alert!*

📊 *${symbol}* is showing high volatility!
📈 24h Change: ${changePercent.toFixed(2)}%

This could be a good trading opportunity. Check the signals!
    `

    // You can implement user notification logic here
    console.log("Volatility spike detected:", symbol, changePercent)
  }
}

module.exports = CoinMonitor

