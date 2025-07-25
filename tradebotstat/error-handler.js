class ErrorHandler {
  static handleTelegramError(error, ctx) {
    console.error("Telegram API Error:", {
      error_code: error.response?.error_code,
      description: error.response?.description,
      method: error.on?.method,
      timestamp: new Date().toISOString(),
    })

    // Handle specific error types
    switch (error.response?.error_code) {
      case 400:
        if (error.response.description.includes("message is not modified")) {
          return "MESSAGE_NOT_MODIFIED"
        }
        if (error.response.description.includes("message to edit not found")) {
          return "MESSAGE_NOT_FOUND"
        }
        break
      case 403:
        console.error("Bot was blocked by user or chat")
        return "BLOCKED"
      case 429:
        console.error("Rate limit exceeded")
        return "RATE_LIMIT"
      case 500:
        console.error("Telegram server error")
        return "SERVER_ERROR"
    }

    return "UNKNOWN_ERROR"
  }

  static async safeApiCall(apiCall, fallback = null) {
    try {
      return await apiCall()
    } catch (error) {
      const errorType = this.handleTelegramError(error)

      if (errorType === "MESSAGE_NOT_MODIFIED") {
        return "NOT_MODIFIED"
      }

      if (fallback) {
        try {
          return await fallback()
        } catch (fallbackError) {
          console.error("Fallback also failed:", fallbackError.message)
        }
      }

      return null
    }
  }

  static setupGlobalHandlers() {
    process.on("uncaughtException", (error) => {
      console.error("🚨 Uncaught Exception:", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      })
      // Don't exit - keep bot running
    })

    process.on("unhandledRejection", (reason, promise) => {
      console.error("🚨 Unhandled Rejection:", {
        reason: reason,
        promise: promise,
        timestamp: new Date().toISOString(),
      })
      // Don't exit - keep bot running
    })

    process.on("warning", (warning) => {
      console.warn("⚠️ Node.js Warning:", {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
        timestamp: new Date().toISOString(),
      })
    })
  }
}

module.exports = ErrorHandler
