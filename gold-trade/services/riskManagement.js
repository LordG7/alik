const config = require("../config/config")
const database = require("../database/database")
const logger = require("../utils/logger")

class RiskManagementService {
  constructor() {
    this.maxDailyTrades = config.trading.maxDailyTrades
    this.riskPerTrade = config.trading.riskPerTrade
    this.dailyTradeCount = 0
    this.lastResetDate = new Date().toDateString()
  }

  async canTrade() {
    // Reset daily counter if new day
    const currentDate = new Date().toDateString()
    if (currentDate !== this.lastResetDate) {
      this.dailyTradeCount = 0
      this.lastResetDate = currentDate
    }

    // Check daily trade limit
    if (this.dailyTradeCount >= this.maxDailyTrades) {
      logger.warn("Daily trade limit reached")
      return false
    }

    // Check trading hours
    if (!this.isWithinTradingHours()) {
      return false
    }

    // Check recent performance
    const stats = await database.getStats()
    if (stats && stats.total_signals > 10) {
      const successRate = stats.successful_signals / stats.total_signals
      if (successRate < 0.6) {
        // If success rate below 60%, be more cautious
        logger.warn("Low success rate detected, reducing trade frequency")
        return Math.random() > 0.5 // 50% chance to trade
      }
    }

    return true
  }

  isWithinTradingHours() {
    const now = new Date()
    const hour = now.getHours()
    return hour >= config.trading.tradingHours.start && hour <= config.trading.tradingHours.end
  }

  validateSignal(signal) {
    if (!signal) return false

    // Minimum confidence threshold
    if (signal.confidence < 70) {
      logger.info(`Signal rejected: Low confidence (${signal.confidence}%)`)
      return false
    }

    // Risk-reward ratio check
    const riskRewardRatio =
      Math.abs(signal.takeProfit - signal.entryPrice) / Math.abs(signal.entryPrice - signal.stopLoss)

    if (riskRewardRatio < 1) {
      logger.info("Signal rejected: Poor risk-reward ratio")
      return false
    }

    // ATR-based volatility check
    if (signal.indicators.atr < 0.5) {
      logger.info("Signal rejected: Low volatility")
      return false
    }

    return true
  }

  incrementTradeCount() {
    this.dailyTradeCount++
  }

  calculatePositionSize(accountBalance, signal) {
    const riskAmount = accountBalance * this.riskPerTrade
    const stopLossDistance = Math.abs(signal.entryPrice - signal.stopLoss)
    const positionSize = riskAmount / stopLossDistance

    return Math.max(0.01, Math.min(positionSize, accountBalance * 0.1)) // Max 10% of account
  }
}

module.exports = new RiskManagementService()
