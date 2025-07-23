const axios = require("axios")

class NewsAnalysis {
  constructor() {
    this.newsApiUrl = process.env.NEWS_API_URL
    this.sentimentKeywords = {
      positive: [
        "bull",
        "bullish",
        "rise",
        "surge",
        "pump",
        "moon",
        "breakout",
        "rally",
        "gain",
        "profit",
        "buy",
        "long",
        "support",
        "breakthrough",
        "adoption",
        "partnership",
        "upgrade",
      ],
      negative: [
        "bear",
        "bearish",
        "fall",
        "crash",
        "dump",
        "drop",
        "sell",
        "short",
        "resistance",
        "decline",
        "loss",
        "fear",
        "panic",
        "regulation",
        "ban",
        "hack",
        "scam",
      ],
    }
  }

  async analyze() {
    try {
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

      // Sentiment skorunu -3 ile +3 arasında normalize et
      const normalizedScore = Math.max(-3, Math.min(3, Math.round(averageSentiment * 3)))

      return {
        sentimentScore: normalizedScore,
        newsCount: newsCount,
        positiveNews: positiveNews,
        negativeNews: negativeNews,
        summary: this.generateSummary(normalizedScore, positiveNews, negativeNews, newsCount),
      }
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
    let sentiment = 0

    // Pozitif kelimeler
    for (const keyword of this.sentimentKeywords.positive) {
      const matches = (lowerText.match(new RegExp(keyword, "g")) || []).length
      sentiment += matches * 0.5
    }

    // Negatif kelimeler
    for (const keyword of this.sentimentKeywords.negative) {
      const matches = (lowerText.match(new RegExp(keyword, "g")) || []).length
      sentiment -= matches * 0.5
    }

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

  // Korku & Açgözlülük Endeksi simülasyonu
  getFearGreedIndex(sentiment, volatility) {
    // 0-100 arası değer (0: Aşırı Korku, 100: Aşırı Açgözlülük)
    let index = 50 // Nötr başlangıç

    // Sentiment etkisi
    index += sentiment * 10

    // Volatilite etkisi (yüksek volatilite = korku)
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
  }
}

module.exports = NewsAnalysis
