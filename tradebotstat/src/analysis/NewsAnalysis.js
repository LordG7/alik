import axios from "axios"
import Sentiment from "sentiment"
import { Logger } from "../utils/Logger.js"

export class NewsAnalysis {
  constructor() {
    this.sentiment = new Sentiment()
    this.logger = new Logger()
    this.newsApiKey = process.env.NEWS_API_KEY
  }

  async analyzeSentiment(query) {
    try {
      // Kripto haber kaynaklarından veri çek
      const newsData = await this.fetchCryptoNews(query)

      if (!newsData || newsData.length === 0) {
        return { score: 0, classification: "neutral", articles: [] }
      }

      let totalScore = 0
      let totalComparative = 0
      const analyzedArticles = []

      newsData.forEach((article) => {
        const text = `${article.title} ${article.description || ""}`
        const analysis = this.sentiment.analyze(text)

        totalScore += analysis.score
        totalComparative += analysis.comparative

        analyzedArticles.push({
          title: article.title,
          score: analysis.score,
          comparative: analysis.comparative,
          url: article.url,
          publishedAt: article.publishedAt,
        })
      })

      const avgScore = totalScore / newsData.length
      const avgComparative = totalComparative / newsData.length

      let classification = "neutral"
      if (avgComparative > 0.1) classification = "positive"
      else if (avgComparative < -0.1) classification = "negative"

      return {
        score: avgComparative,
        classification,
        totalArticles: newsData.length,
        articles: analyzedArticles.slice(0, 5), // Son 5 makale
      }
    } catch (error) {
      this.logger.error("Haber sentiment analizi hatası:", error)
      return { score: 0, classification: "neutral", articles: [] }
    }
  }

  async fetchCryptoNews(query) {
    try {
      const sources = [
        await this.fetchFromNewsAPI(query),
        await this.fetchFromCoinDesk(),
        await this.fetchFromCoinTelegraph(),
      ]

      // Tüm kaynaklardan gelen haberleri birleştir
      const allNews = sources.flat().filter(Boolean)

      // Tarih sırasına göre sırala (en yeni önce)
      return allNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    } catch (error) {
      this.logger.error("Haber çekme hatası:", error)
      return []
    }
  }

  async fetchFromNewsAPI(query) {
    try {
      if (!this.newsApiKey) return []

      const response = await axios.get("https://newsapi.org/v2/everything", {
        params: {
          q: `${query} OR cryptocurrency OR crypto OR bitcoin`,
          language: "en",
          sortBy: "publishedAt",
          pageSize: 20,
          apiKey: this.newsApiKey,
        },
      })

      return response.data.articles.map((article) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        publishedAt: article.publishedAt,
        source: "NewsAPI",
      }))
    } catch (error) {
      this.logger.error("NewsAPI hatası:", error)
      return []
    }
  }

  async fetchFromCoinDesk() {
    try {
      // CoinDesk RSS feed'ini parse et
      const response = await axios.get("https://www.coindesk.com/arc/outboundfeeds/rss/")
      // RSS parsing logic burada olacak
      return []
    } catch (error) {
      return []
    }
  }

  async fetchFromCoinTelegraph() {
    try {
      // CoinTelegraph API'sini kullan
      return []
    } catch (error) {
      return []
    }
  }

  // Volatilite yaratan haber türlerini tespit et
  detectVolatilityNews(articles) {
    const volatilityKeywords = [
      "regulation",
      "ban",
      "hack",
      "crash",
      "pump",
      "dump",
      "sec",
      "lawsuit",
      "investigation",
      "partnership",
      "adoption",
      "institutional",
      "whale",
      "liquidation",
    ]

    return articles.filter((article) => {
      const text = `${article.title} ${article.description || ""}`.toLowerCase()
      return volatilityKeywords.some((keyword) => text.includes(keyword))
    })
  }
}
