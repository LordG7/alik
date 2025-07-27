class PositionManager {
  constructor(binanceClient, database) {
    this.binance = binanceClient
    this.db = database
  }

  async getUserPositions(userId) {
    try {
      // Get positions from Binance API
      const account = await this.binance.futuresAccountInfo()
      const positions = account.positions.filter((pos) => Number.parseFloat(pos.positionAmt) !== 0)

      return positions.map((pos) => ({
        symbol: pos.symbol,
        positionSide: pos.positionSide,
        positionAmt: pos.positionAmt,
        entryPrice: pos.entryPrice,
        markPrice: pos.markPrice,
        unrealizedPnl: pos.unRealizedProfit,
        percentage: pos.percentage,
      }))
    } catch (error) {
      console.error("Error fetching user positions:", error)
      return []
    }
  }

  async updateUserPositions(userId) {
    try {
      const positions = await this.getUserPositions(userId)

      // Update database with current positions
      for (const position of positions) {
        await this.updatePositionInDB(userId, position)
      }
    } catch (error) {
      console.error(`Error updating positions for user ${userId}:`, error)
    }
  }

  async updatePositionInDB(userId, position) {
    return new Promise((resolve, reject) => {
      this.db.db.run(
        `
                INSERT OR REPLACE INTO positions 
                (user_id, symbol, side, size, entry_price, current_price, pnl, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')
            `,
        [
          userId,
          position.symbol,
          position.positionSide,
          position.positionAmt,
          position.entryPrice,
          position.markPrice,
          position.unrealizedPnl,
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        },
      )
    })
  }

  async getDailyPnL(userId) {
    return await this.db.getDailyPnL(userId)
  }

  // Auto trading functions (optional advanced feature)
  async executeAutoTrade(userId, signal) {
    try {
      // This is an advanced feature for automatic trading
      // Requires user's API keys and proper risk management

      const quantity = this.calculatePositionSize(signal)
      const orderParams = {
        symbol: signal.symbol,
        side: signal.type === "LONG" ? "BUY" : "SELL",
        type: "MARKET",
        quantity: quantity,
      }

      // Execute the trade
      const order = await this.binance.futuresOrder(orderParams)

      // Set stop loss
      await this.setStopLoss(signal, order)

      // Set take profit orders
      await this.setTakeProfits(signal, order)

      return order
    } catch (error) {
      console.error("Error executing auto trade:", error)
      throw error
    }
  }

  calculatePositionSize(signal) {
    // Calculate position size based on risk management
    // This should be configurable per user
    const riskPercentage = 0.02 // 2% risk per trade
    const accountBalance = 1000 // This should come from user's account
    const riskAmount = accountBalance * riskPercentage

    const entryPrice = Number.parseFloat(signal.entries[0])
    const stopLoss = Number.parseFloat(signal.stopLoss)
    const riskPerUnit = Math.abs(entryPrice - stopLoss)

    return (riskAmount / riskPerUnit).toFixed(3)
  }

  async setStopLoss(signal, order) {
    const stopLossOrder = {
      symbol: signal.symbol,
      side: signal.type === "LONG" ? "SELL" : "BUY",
      type: "STOP_MARKET",
      quantity: order.executedQty,
      stopPrice: signal.stopLoss,
      reduceOnly: true,
    }

    return await this.binance.futuresOrder(stopLossOrder)
  }

  async setTakeProfits(signal, order) {
    const tpOrders = []
    const quantity = Number.parseFloat(order.executedQty)
    const tpQuantities = [quantity * 0.4, quantity * 0.3, quantity * 0.3]

    for (let i = 0; i < signal.takeProfits.length; i++) {
      const tpOrder = {
        symbol: signal.symbol,
        side: signal.type === "LONG" ? "SELL" : "BUY",
        type: "LIMIT",
        quantity: tpQuantities[i].toFixed(3),
        price: signal.takeProfits[i],
        timeInForce: "GTC",
        reduceOnly: true,
      }

      try {
        const order = await this.binance.futuresOrder(tpOrder)
        tpOrders.push(order)
      } catch (error) {
        console.error(`Error setting TP${i + 1}:`, error)
      }
    }

    return tpOrders
  }
}

module.exports = PositionManager
