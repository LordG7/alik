require("dotenv").config()

module.exports = {
  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",

  // Binance API Configuration
  BINANCE_API_KEY: process.env.BINANCE_API_KEY || "",
  BINANCE_SECRET: process.env.BINANCE_SECRET || "",
  SANDBOX_MODE: process.env.NODE_ENV !== "production",

  // Trading Configuration
  DEFAULT_RISK_REWARD: 1, // 1:1 Risk-Reward Ratio
  MAX_ACTIVE_SIGNALS: 5,
  MIN_SIGNAL_STRENGTH: 4, // Minimum 4 out of 5 indicators

  // Server Configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Database (if needed)
  DATABASE_URL: process.env.DATABASE_URL || "",

  // Rate Limiting
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 100, // Max requests per window
}
