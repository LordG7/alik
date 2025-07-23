import pkg from "sentiment"
import { Logger } from "../utils/Logger.js"

const Sentiment = pkg.default || pkg

export class NewsAnalysis {
  constructor() {
    this.sentiment = new Sentiment()
    this.logger = new Logger()
    this.newsApiKey = process.env.NEWS_API_KEY
  }

  async analyzeSentiment(query) {
    try {
      // Basit sentiment analizi (haber API'si olmadan)
      const mockNews = [
        {
          title: "INJ cryptocurrency shows positive momentum",
          description: "Technical indicators suggest bullish trend",
        },
        { title: "Market analysis indicates stable growth", description: "Trading volume remains healthy" },
      ]

      let totalScore = 0
      let totalComparative = 0
      const analyzedArticles = []

      mockNews.forEach((article) => {
        const text = `${article.title} ${article.description || ""}`
        const analysis = this.sentiment.analyze(text)

        totalScore += analysis.score
        totalComparative += analysis.comparative

        analyzedArticles.push({
          title: article.title,
          score: analysis.score,
          comparative: analysis.comparative,
          publishedAt: new Date().toISOString(),
        })
      })

      const avgComparative = totalComparative / mockNews.length

      let classification = "neutral"
      if (avgComparative > 0.1) classification = "positive"
      else if (avgComparative < -0.1) classification = "negative"

      return {
        score: avgComparative,
        classification,
        totalArticles: mockNews.length,
        articles: analyzedArticles,
      }
    } catch (error) {
      this.logger.error("Haber sentiment analizi hatası:", error)
      return { score: 0, classification: "neutral", articles: [] }
    }
  }
}
