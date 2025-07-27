const sqlite3 = require("sqlite3").verbose()

class Database {
  constructor() {
    this.db = new sqlite3.Database("./trading_bot.db")
    this.init()
  }

  init() {
    this.db.serialize(() => {
      // Users table
      this.db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY,
                    telegram_id INTEGER UNIQUE,
                    username TEXT,
                    selected_coin TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `)

      // Signals table
      this.db.run(`
                CREATE TABLE IF NOT EXISTS signals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    symbol TEXT,
                    signal_type TEXT,
                    price REAL,
                    entry_price REAL,
                    stop_loss REAL,
                    take_profit TEXT,
                    confidence INTEGER,
                    timeframe TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (telegram_id)
                )
            `)

      // Positions table
      this.db.run(`
                CREATE TABLE IF NOT EXISTS positions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    symbol TEXT,
                    side TEXT,
                    size REAL,
                    entry_price REAL,
                    current_price REAL,
                    pnl REAL,
                    status TEXT DEFAULT 'OPEN',
                    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    closed_at DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users (telegram_id)
                )
            `)

      // Trades table for PnL tracking
      this.db.run(`
                CREATE TABLE IF NOT EXISTS trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    symbol TEXT,
                    side TEXT,
                    quantity REAL,
                    entry_price REAL,
                    exit_price REAL,
                    pnl REAL,
                    commission REAL,
                    trade_date DATE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (telegram_id)
                )
            `)
    })
  }

  async addUser(telegramId, username) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT OR REPLACE INTO users (telegram_id, username) VALUES (?, ?)",
        [telegramId, username],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        },
      )
    })
  }

  async updateUserCoins(telegramId, coins) {
    return new Promise((resolve, reject) => {
      const coinsJson = JSON.stringify(coins)
      this.db.run("UPDATE users SET selected_coin = ? WHERE telegram_id = ?", [coinsJson, telegramId], function (err) {
        if (err) reject(err)
        else resolve(this.changes)
      })
    })
  }

  async getUserCoins(telegramId) {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT selected_coin FROM users WHERE telegram_id = ?", [telegramId], (err, row) => {
        if (err) reject(err)
        else {
          try {
            const coins = row && row.selected_coin ? JSON.parse(row.selected_coin) : []
            resolve(coins)
          } catch (parseError) {
            resolve([])
          }
        }
      })
    })
  }

  async updateUserCoin(telegramId, coin) {
    return new Promise((resolve, reject) => {
      this.db.run("UPDATE users SET selected_coin = ? WHERE telegram_id = ?", [coin, telegramId], function (err) {
        if (err) reject(err)
        else resolve(this.changes)
      })
    })
  }

  async saveSignal(userId, signal) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
                INSERT INTO signals (user_id, symbol, signal_type, price, entry_price, 
                                   stop_loss, take_profit, confidence, timeframe)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          userId,
          signal.symbol,
          signal.type,
          signal.price,
          signal.entries[0],
          signal.stopLoss,
          JSON.stringify(signal.takeProfits),
          signal.confidence,
          signal.timeframe,
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        },
      )
    })
  }

  async getUserSignals(userId, limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM signals WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        [userId, limit],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows)
        },
      )
    })
  }

  async saveTrade(userId, trade) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
                INSERT INTO trades (user_id, symbol, side, quantity, entry_price, 
                                  exit_price, pnl, commission, trade_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE('now'))
            `,
        [
          userId,
          trade.symbol,
          trade.side,
          trade.quantity,
          trade.entryPrice,
          trade.exitPrice,
          trade.pnl,
          trade.commission,
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        },
      )
    })
  }

  async getDailyPnL(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT 
                    symbol,
                    SUM(pnl) as total_pnl,
                    COUNT(*) as trade_count,
                    SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades
                FROM trades 
                WHERE user_id = ? AND trade_date = DATE('now')
                GROUP BY symbol
                ORDER BY total_pnl DESC
            `,
        [userId],
        (err, rows) => {
          if (err) reject(err)
          else {
            const totalPnl = rows.reduce((sum, row) => sum + row.total_pnl, 0)
            const totalTrades = rows.reduce((sum, row) => sum + row.trade_count, 0)
            const winningTrades = rows.reduce((sum, row) => sum + row.winning_trades, 0)

            resolve({
              totalPnl: totalPnl.toFixed(2),
              totalTrades,
              winningTrades,
              losingTrades: totalTrades - winningTrades,
              winRate: totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : 0,
              topCoins: rows.slice(0, 5).map((row) => ({
                symbol: row.symbol,
                pnl: row.total_pnl.toFixed(2),
              })),
            })
          }
        },
      )
    })
  }
}

module.exports = Database
