import Foundation

enum AppEnvironment {
    static let apiBaseURL: URL = {
        let rawURL = ProcessInfo.processInfo.environment["IOS_API_BASE_URL"] ?? "http://127.0.0.1:3000"
        return URL(string: rawURL) ?? URL(string: "http://127.0.0.1:3000")!
    }()
}

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.encoder = JSONEncoder()
    }

    func fetchFeed(userId: String, cursor: String?) async -> FeedResponse {
        var components = URLComponents(url: AppEnvironment.apiBaseURL, resolvingAgainstBaseURL: false)
        components?.path = "/v1/feed"
        components?.queryItems = [
            URLQueryItem(name: "userId", value: userId),
            URLQueryItem(name: "cursor", value: cursor),
            URLQueryItem(name: "limit", value: "4")
        ]

        guard let url = components?.url else {
            return FeedResponse.preview
        }

        do {
            let (data, response) = try await session.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode)
            else {
                return FeedResponse.preview
            }
            return try decoder.decode(FeedResponse.self, from: data)
        } catch {
            return FeedResponse.preview
        }
    }

    func fetchArticle(id: String) async -> Article? {
        var components = URLComponents(url: AppEnvironment.apiBaseURL, resolvingAgainstBaseURL: false)
        components?.path = "/v1/articles/\(id)"

        guard let url = components?.url else {
            return nil
        }

        do {
            let (data, response) = try await session.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode)
            else {
                return nil
            }
            return try decoder.decode(Article.self, from: data)
        } catch {
            return nil
        }
    }

    func fetchProfile(userId: String) async -> UserProfile? {
        var components = URLComponents(url: AppEnvironment.apiBaseURL, resolvingAgainstBaseURL: false)
        components?.path = "/v1/profile/\(userId)"

        guard let url = components?.url else {
            return nil
        }

        do {
            let (data, response) = try await session.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode)
            else {
                return nil
            }
            return try decoder.decode(UserProfile.self, from: data)
        } catch {
            return nil
        }
    }

    func updateTopics(userId: String, selectedTopics: [String]) async -> UserProfile? {
        guard let url = URL(string: "/v1/profile/\(userId)/topics", relativeTo: AppEnvironment.apiBaseURL) else {
            return nil
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? encoder.encode([
            "selectedTopics": selectedTopics
        ])

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode)
            else {
                return nil
            }
            return try decoder.decode(UserProfile.self, from: data)
        } catch {
            return nil
        }
    }
}
