import dotenv from "dotenv"
import { Logger } from "../utils/Logger.js"

// .env dosyasını yükle
dotenv.config()

const logger = new Logger()

// Environment variables'ları kontrol et ve validate et
export class Environment {
  static validate() {
    const required = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "BINANCE_API_KEY", "BINANCE_API_SECRET"]

    const missing = []
    const config = {}

    required.forEach((key) => {
      const value = process.env[key]
      if (!value || value.trim() === "") {
        missing.push(key)
      } else {
        config[key] = value.trim()
      }
    })

    if (missing.length > 0) {
      logger.error(`❌ Eksik environment variables: ${missing.join(", ")}`)
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
    }

    // Telegram token formatını kontrol et
    if (!config.TELEGRAM_BOT_TOKEN.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      logger.error("❌ Geçersiz Telegram bot token formatı")
      throw new Error("Invalid Telegram bot token format")
    }

    // Chat ID sayısal mı kontrol et
    if (!config.TELEGRAM_CHAT_ID.match(/^-?\d+$/)) {
      logger.error("❌ Geçersiz Telegram chat ID formatı")
      throw new Error("Invalid Telegram chat ID format")
    }

    logger.info("✅ Tüm environment variables geçerli")
    return config
  }

  static get() {
    return {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN?.trim(),
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID?.trim(),
      BINANCE_API_KEY: process.env.BINANCE_API_KEY?.trim(),
      BINANCE_API_SECRET: process.env.BINANCE_API_SECRET?.trim(),
      NEWS_API_KEY: process.env.NEWS_API_KEY?.trim(),
      FEAR_GREED_API: process.env.FEAR_GREED_API?.trim() || "https://api.alternative.me/fng/",
      NODE_ENV: process.env.NODE_ENV?.trim() || "production",
      TZ: process.env.TZ?.trim() || "Asia/Baku",
    }
  }

  static debug() {
    const config = this.get()
    logger.info("🔍 Environment Debug:")

    Object.keys(config).forEach((key) => {
      const value = config[key]
      if (key.includes("TOKEN") || key.includes("SECRET") || key.includes("KEY")) {
        logger.info(`${key}: ${value ? `SET (${value.substring(0, 10)}...)` : "NOT SET"}`)
      } else {
        logger.info(`${key}: ${value || "NOT SET"}`)
      }
    })
  }
}
