const PairsManager = require("../pairs-manager")

// Performance monitoring script
class PerformanceMonitor {
  constructor() {
    this.pairsManager = new PairsManager()
  }

  generateDailyReport() {
    const report = this.pairsManager.getDailyReport()

    console.log("=== DAILY PERFORMANCE REPORT ===")
    console.log(`Total Trades: ${report.totalTrades}`)
    console.log(`Total PnL: ${report.totalPnl.toFixed(2)}%`)
    console.log(`Average Win Rate: ${report.avgWinRate.toFixed(1)}%`)
    console.log(`Best Performing Pair: ${report.bestPair || "N/A"}`)
    console.log(`Worst Performing Pair: ${report.worstPair || "N/A"}`)
    console.log(`Active Pairs: ${report.activePairs}`)

    return report
  }

  generatePairAnalysis() {
    const allStats = this.pairsManager.getAllPairStats()

    console.log("\n=== PAIR ANALYSIS ===")
    for (const [symbol, stats] of Object.entries(allStats)) {
      console.log(`\n${symbol}:`)
      console.log(`  Trades: ${stats.trades}`)
      console.log(`  Win Rate: ${stats.winRate.toFixed(1)}%`)
      console.log(`  Total PnL: ${stats.totalPnl.toFixed(2)}%`)
      console.log(`  Avg Win: ${stats.avgWin.toFixed(2)}%`)
      console.log(`  Avg Loss: ${stats.avgLoss.toFixed(2)}%`)
    }
  }
}

// Run if called directly
if (require.main === module) {
  const monitor = new PerformanceMonitor()
  monitor.generateDailyReport()
  monitor.generatePairAnalysis()
}

module.exports = PerformanceMonitor
