class RiskManager {
  constructor() {
    this.maxRiskPerTrade = 0.02 // 2% risk per trade
    this.maxDailyLoss = 0.05 // 5% max daily loss
    this.dailyPnL = 0
    this.lastResetDate = new Date().toDateString()
  }

  calculatePositionSize(accountBalance, entryPrice, stopLoss) {
    // Reset daily PnL if new day
    const today = new Date().toDateString()
    if (today !== this.lastResetDate) {
      this.dailyPnL = 0
      this.lastResetDate = today
    }

    // Check if daily loss limit reached
    if (this.dailyPnL <= -this.maxDailyLoss) {
      return 0 // No trading allowed
    }

    const riskAmount = accountBalance * this.maxRiskPerTrade
    const stopDistance = Math.abs(entryPrice - stopLoss)
    const positionSize = riskAmount / stopDistance

    return Math.min(positionSize, accountBalance * 0.1) // Max 10% of balance
  }

  updateDailyPnL(pnlPercent) {
    this.dailyPnL += pnlPercent / 100
  }

  canTrade() {
    return this.dailyPnL > -this.maxDailyLoss
  }

  getRiskMetrics() {
    return {
      dailyPnL: this.dailyPnL,
      maxDailyLoss: this.maxDailyLoss,
      canTrade: this.canTrade(),
    }
  }
}

module.exports = RiskManager
