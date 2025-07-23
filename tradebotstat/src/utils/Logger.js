import winston from "winston"

export class Logger {
  constructor() {
    this.logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: "inj-trading-bot" },
      transports: [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
      ],
    })
  }

  info(message, meta = {}) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta)
  }

  error(message, error = null) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error)
  }

  warn(message, meta = {}) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta)
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta)
  }
}
