require("dotenv").config()

module.exports = {
  telegram: {
    token: process.env.BOT_TOKEN,
    adminUserId: Number.parseInt(process.env.ADMIN_USER_ID),
  },
  trading: {
    symbol: "GOLD_FUTURES",
    timeframes: ["1m", "5m"],
    riskPerTrade: 0.02, // 2% risk per trade
    maxDailyTrades: 20,
    tradingHours: {
      start: 9,
      end: 20,
      timezone: "America/New_York",
    },
  },
  indicators: {
    ema: {
      fast: 10,
      slow: 50,
    },
    rsi: {
      period: 7,
      overbought: 70,
      oversold: 30,
    },
    stochastic: {
      kPeriod: 5,
      dPeriod: 3,
      slowing: 3,
    },
    cci: {
      period: 20,
      overbought: 100,
      oversold: -100,
    },
    atr: {
      period: 14,
    },
    bollinger: {
      period: 20,
      stdDev: 2.0,
    },
    macd: {
      fast: 12,
      slow: 26,
      signal: 9,
    },
  },
  database: {
    path: process.env.DATABASE_PATH || "./trading_bot.db",
  },
  api: {
    tradingViewUrl: "https://scanner.tradingview.com",
    symbol: "COMEX:GC1!", // GOLD Futures main contract
    intervals: ["1m", "5m"],
    requestTimeout: 10000,
  },
}
