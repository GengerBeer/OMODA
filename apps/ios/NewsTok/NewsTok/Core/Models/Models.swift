import Foundation

struct ArticleSummary: Codable, Hashable {
    let title: String
    let summaryShort: String
    let category: String
}

struct Article: Codable, Hashable, Identifiable {
    let id: String
    let source: String
    let title: String
    let body: String
    let imageUrl: String
    let publishedAt: String
    let summary: ArticleSummary
}

struct FeedItem: Codable, Hashable, Identifiable {
    let articleId: String
    let score: Double
    let reason: String
    let article: Article

    var id: String { articleId }
}

struct FeedResponse: Codable, Hashable {
    let items: [FeedItem]
    let nextCursor: String?
}

struct UserProfile: Codable, Hashable {
    let userId: String
    let selectedTopics: [String]
    let interestWeights: [String: Double]
}

extension FeedResponse {
    static let preview = FeedResponse(
        items: [
            FeedItem(
                articleId: "article-1",
                score: 0.95,
                reason: "Because you follow technology and world news",
                article: Article(
                    id: "article-1",
                    source: "Signal Daily",
                    title: "AI chips are reshaping the next wave of mobile devices",
                    body: "Manufacturers are redesigning their roadmaps around on-device AI workloads, with battery efficiency and privacy positioned as the main differentiators for next-generation devices.",
                    imageUrl: "",
                    publishedAt: "2026-04-03T08:00:00Z",
                    summary: ArticleSummary(
                        title: "AI chips are reshaping the next wave of mobile devices",
                        summaryShort: "Phone makers are betting on faster on-device AI and better battery efficiency as the next premium feature set.",
                        category: "technology"
                    )
                )
            ),
            FeedItem(
                articleId: "article-2",
                score: 0.91,
                reason: "Because you spend more time on business stories",
                article: Article(
                    id: "article-2",
                    source: "Market Notebook",
                    title: "European climate startups find momentum in industrial software",
                    body: "A new cohort of industrial software startups is attracting capital by helping manufacturers measure emissions, model energy use and automate reporting across supply chains.",
                    imageUrl: "",
                    publishedAt: "2026-04-03T09:15:00Z",
                    summary: ArticleSummary(
                        title: "European climate startups find momentum in industrial software",
                        summaryShort: "Investors are backing industrial software teams that help manufacturers monitor energy and emissions in real time.",
                        category: "business"
                    )
                )
            ),
            FeedItem(
                articleId: "article-3",
                score: 0.88,
                reason: "Because you liked science explainers",
                article: Article(
                    id: "article-3",
                    source: "Orbit Weekly",
                    title: "A compact telescope design could widen access to deep-space imaging",
                    body: "Researchers are testing a lighter mirror assembly and simplified tracking system that could lower the cost of high-resolution space imaging for universities and small observatories.",
                    imageUrl: "",
                    publishedAt: "2026-04-03T10:30:00Z",
                    summary: ArticleSummary(
                        title: "A compact telescope design could widen access to deep-space imaging",
                        summaryShort: "A cheaper telescope design may give smaller labs access to sharper deep-space observations.",
                        category: "science"
                    )
                )
            )
        ],
        nextCursor: nil
    )
}
