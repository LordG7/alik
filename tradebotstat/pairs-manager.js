class PairsManager {
  constructor() {
    this.pairStats = new Map()
    this.resetDailyStats()
  }

  resetDailyStats() {
    // Reset stats daily at midnight
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const msUntilMidnight = tomorrow.getTime() - now.getTime()

    setTimeout(() => {
      this.pairStats.clear()
      this.resetDailyStats() // Schedule next reset
    }, msUntilMidnight)
  }

  recordTrade(symbol, side, entryPrice) {
    if (!this.pairStats.has(symbol)) {
      this.pairStats.set(symbol, {
        trades: 0,
        wins: 0,
        losses: 0,
        totalPnl: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        lastTrade: null,
      })
    }

    const stats = this.pairStats.get(symbol)
    stats.trades++
    stats.lastTrade = {
      side,
      entryPrice,
      timestamp: Date.now(),
    }
  }

  recordClose(symbol, isWin, pnlPercent) {
    const stats = this.pairStats.get(symbol)
    if (!stats) return

    stats.totalPnl += pnlPercent

    if (isWin) {
      stats.wins++
      stats.avgWin = (stats.avgWin * (stats.wins - 1) + pnlPercent) / stats.wins
    } else {
      stats.losses++
      stats.avgLoss = (stats.avgLoss * (stats.losses - 1) + Math.abs(pnlPercent)) / stats.losses
    }

    stats.winRate = (stats.wins / stats.trades) * 100
  }

  getPairStats(symbol) {
    return (
      this.pairStats.get(symbol) || {
        trades: 0,
        wins: 0,
        losses: 0,
        totalPnl: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
      }
    )
  }

  getAllPairStats() {
    const allStats = {}
    for (const [symbol, stats] of this.pairStats) {
      allStats[symbol] = { ...stats }
    }
    return allStats
  }

  getBestPerformingPair() {
    let bestPair = null
    let bestPnl = Number.NEGATIVE_INFINITY

    for (const [symbol, stats] of this.pairStats) {
      if (stats.totalPnl > bestPnl) {
        bestPnl = stats.totalPnl
        bestPair = symbol
      }
    }

    return bestPair
  }

  getWorstPerformingPair() {
    let worstPair = null
    let worstPnl = Number.POSITIVE_INFINITY

    for (const [symbol, stats] of this.pairStats) {
      if (stats.totalPnl < worstPnl) {
        worstPnl = stats.totalPnl
        worstPair = symbol
      }
    }

    return worstPair
  }

  getDailyReport() {
    const totalTrades = Array.from(this.pairStats.values()).reduce((sum, stats) => sum + stats.trades, 0)
    const totalPnl = Array.from(this.pairStats.values()).reduce((sum, stats) => sum + stats.totalPnl, 0)
    const avgWinRate =
      Array.from(this.pairStats.values()).reduce((sum, stats) => sum + stats.winRate, 0) / this.pairStats.size || 0

    return {
      totalTrades,
      totalPnl,
      avgWinRate,
      bestPair: this.getBestPerformingPair(),
      worstPair: this.getWorstPerformingPair(),
      activePairs: this.pairStats.size,
    }
  }
}

module.exports = PairsManager
