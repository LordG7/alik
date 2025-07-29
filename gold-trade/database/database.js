const sqlite3 = require("sqlite3").verbose()
const config = require("../config/config")
const logger = require("../utils/logger")

class Database {
  constructor() {
    this.db = new sqlite3.Database(config.database.path, (err) => {
      if (err) {
        logger.error("Database connection error:", err)
      } else {
        logger.info("Connected to SQLite database")
        this.initTables()
      }
    })
  }

  initTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        telegram_id INTEGER UNIQUE,
        username TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signal_type TEXT NOT NULL,
        entry_price REAL,
        stop_loss REAL,
        take_profit REAL,
        confidence REAL,
        indicators_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active'
      )`,
      `CREATE TABLE IF NOT EXISTS performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signal_id INTEGER,
        result TEXT,
        profit_loss REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (signal_id) REFERENCES signals (id)
      )`,
      `CREATE TABLE IF NOT EXISTS bot_stats (
        id INTEGER PRIMARY KEY,
        total_signals INTEGER DEFAULT 0,
        successful_signals INTEGER DEFAULT 0,
        failed_signals INTEGER DEFAULT 0,
        total_profit REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    ]

    tables.forEach((table) => {
      this.db.run(table, (err) => {
        if (err) logger.error("Table creation error:", err)
      })
    })

    // Initialize bot stats
    this.db.run(`INSERT OR IGNORE INTO bot_stats (id) VALUES (1)`)
  }

  addUser(telegramId, username) {
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

  getActiveUsers() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT telegram_id FROM users WHERE is_active = 1", (err, rows) => {
        if (err) reject(err)
        else resolve(rows.map((row) => row.telegram_id))
      })
    })
  }

  addSignal(signalData) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO signals (signal_type, entry_price, stop_loss, take_profit, confidence, indicators_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          signalData.type,
          signalData.entryPrice,
          signalData.stopLoss,
          signalData.takeProfit,
          signalData.confidence,
          JSON.stringify(signalData.indicators),
        ],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        },
      )
    })
  }

  updateStats(successful, profitLoss) {
    const updateQuery = successful
      ? "UPDATE bot_stats SET total_signals = total_signals + 1, successful_signals = successful_signals + 1, total_profit = total_profit + ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1"
      : "UPDATE bot_stats SET total_signals = total_signals + 1, failed_signals = failed_signals + 1, total_profit = total_profit + ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1"

    this.db.run(updateQuery, [profitLoss])
  }

  getStats() {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM bot_stats WHERE id = 1", (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }
}

module.exports = new Database()
