const axios = require("axios")

class NewsAnalysis {
  constructor() {
    // Haber API'si kaldırıldı, sadece Binance verilerini kullanacağız
    this.binanceApiUrl = process.env.BINANCE_API_URL
  }

  async analyze() {
    try {
      // Geçici olarak haber analizi devre dışı bırak
      console.log("📊 Sadece teknik analiz kullanılıyor (Binance API)")

      return {
        sentimentScore: 0, // Her zaman nötr
        newsCount: 0,
        positiveNews: 0,
        negativeNews: 0,
        summary: "📊 Sadece teknik analiz kullanılıyor (Binance API)",
      }

      // Orijinal kod (geçici olarak kapalı)
      /*
      const response = await axios.get(this.newsApiUrl, {
        timeout: 10000,
      })

      if (!response.data || !response.data.data) {
        return { sentimentScore: 0, newsCount: 0, summary: "Haber verisi alınamadı" }
      }

      const news = response.data.data
      let totalSentiment = 0
      const newsCount = news.length
      let positiveNews = 0
      let negativeNews = 0

      for (const article of news) {
        const sentiment = this.analyzeSentiment(article.title + " " + (article.text || ""))
        totalSentiment += sentiment

        if (sentiment > 0) positiveNews++
        if (sentiment < 0) negativeNews++
      }

      const averageSentiment = newsCount > 0 ? totalSentiment / newsCount : 0
      const normalizedScore = Math.max(-3, Math.min(3, Math.round(averageSentiment * 3)))

      return {
        sentimentScore: normalizedScore,
        newsCount: newsCount,
        positiveNews: positiveNews,
        negativeNews: negativeNews,
        summary: this.generateSummary(normalizedScore, positiveNews, negativeNews, newsCount),
      }
      */
    } catch (error) {
      console.error("Haber analizi hatası:", error.message)
      return {
        sentimentScore: 0,
        newsCount: 0,
        summary: "Haber analizi yapılamadı: " + error.message,
      }
    }
  }

  analyzeSentiment(text) {
    if (!text) return 0

    const lowerText = text.toLowerCase()
    const sentiment = 0

    // Pozitif kelimeler
    // const positiveKeywords = [
    //   "bull",
    //   "bullish",
    //   "rise",
    //   "surge",
    //   "pump",
    //   "moon",
    //   "breakout",
    //   "rally",
    //   "gain",
    //   "profit",
    //   "buy",
    //   "long",
    //   "support",
    //   "breakthrough",
    //   "adoption",
    //   "partnership",
    //   "upgrade",
    // ]
    // for (const keyword of positiveKeywords) {
    //   const matches = (lowerText.match(new RegExp(keyword, "g")) || []).length
    //   sentiment += matches * 0.5
    // }

    // Negatif kelimeler
    // const negativeKeywords = [
    //   "bear",
    //   "bearish",
    //   "fall",
    //   "crash",
    //   "dump",
    //   "drop",
    //   "sell",
    //   "short",
    //   "resistance",
    //   "decline",
    //   "loss",
    //   "fear",
    //   "panic",
    //   "regulation",
    //   "ban",
    //   "hack",
    //   "scam",
    // ]
    // for (const keyword of negativeKeywords) {
    //   const matches = (lowerText.match(new RegExp(keyword, "g")) || []).length
    //   sentiment -= matches * 0.5
    // }

    return sentiment
  }

  generateSummary(score, positive, negative, total) {
    if (score > 1) {
      return `📈 Güçlü pozitif haber akışı (${positive}/${total} pozitif)`
    } else if (score > 0) {
      return `📊 Hafif pozitif haber akışı (${positive}/${total} pozitif)`
    } else if (score < -1) {
      return `📉 Güçlü negatif haber akışı (${negative}/${total} negatif)`
    } else if (score < 0) {
      return `📊 Hafif negatif haber akışı (${negative}/${total} negatif)`
    } else {
      return `⚖️ Nötr haber akışı (${total} haber)`
    }
  }

  // Korku & Açgözlülük Endeksi simülasyonu (sadece volatilite bazlı)
  async getFearGreedIndexWithBinanceData() {
    try {
      const response = await axios.get(this.binanceApiUrl, {
        timeout: 10000,
      })

      if (!response.data || !response.data.volatility) {
        return { index: 50, label: "Nötr" }
      }

      const volatility = response.data.volatility
      let index = 50 // Nötr başlangıç

      // Sadece volatilite etkisi (yüksek volatilite = korku)
      index -= volatility * 200

      // 0-100 arasında sınırla
      index = Math.max(0, Math.min(100, index))

      let label = ""
      if (index <= 25) label = "Aşırı Korku"
      else if (index <= 45) label = "Korku"
      else if (index <= 55) label = "Nötr"
      else if (index <= 75) label = "Açgözlülük"
      else label = "Aşırı Açgözlülük"

      return { index: Math.round(index), label }
    } catch (error) {
      console.error("Binance veri çekme hatası:", error.message)
      return { index: 50, label: "Nötr" }
    }
  }
}

module.exports = NewsAnalysis
