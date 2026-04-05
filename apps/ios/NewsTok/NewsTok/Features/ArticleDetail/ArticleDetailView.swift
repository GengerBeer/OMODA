import SwiftUI

@MainActor
final class ArticleDetailViewModel: ObservableObject {
    @Published var article: Article
    @Published var isRefreshing = false

    private let apiClient: APIClient

    init(article: Article, apiClient: APIClient = .shared) {
        self.article = article
        self.apiClient = apiClient
    }

    func refreshIfNeeded() async {
        guard isRefreshing == false else { return }

        isRefreshing = true
        defer { isRefreshing = false }

        if let latestArticle = await apiClient.fetchArticle(id: article.id) {
            article = latestArticle
        }
    }
}

struct ArticleDetailView: View {
    @StateObject private var viewModel: ArticleDetailViewModel

    init(article: Article) {
        _viewModel = StateObject(wrappedValue: ArticleDetailViewModel(article: article))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                RoundedRectangle(cornerRadius: NewsTokTheme.CornerRadius.card, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                NewsTokTheme.Colors.cardTop,
                                NewsTokTheme.Colors.cardBottom
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 240)
                    .overlay(alignment: .bottomLeading) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(viewModel.article.summary.category.uppercased())
                                .font(.system(.caption, design: .rounded, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.72))

                            Text(viewModel.article.title)
                                .font(.system(.title, design: .rounded, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .padding(24)
                    }

                VStack(alignment: .leading, spacing: 16) {
                    Text(viewModel.article.summary.summaryShort)
                        .font(.system(.title3, design: .rounded, weight: .semibold))
                        .foregroundStyle(NewsTokTheme.Colors.primaryText)

                    Text(viewModel.article.body)
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(NewsTokTheme.Colors.secondaryText)

                    LabeledContent("Source", value: viewModel.article.source)
                    LabeledContent("Published", value: viewModel.article.publishedAt)
                }
                .font(.system(.body, design: .rounded))
            }
            .padding(NewsTokTheme.Spacing.screenPadding)
        }
        .background(NewsTokTheme.Colors.background.ignoresSafeArea())
        .navigationTitle("Story")
        .navigationBarTitleDisplayMode(.inline)
        .overlay(alignment: .topTrailing) {
            if viewModel.isRefreshing {
                ProgressView()
                    .padding()
            }
        }
        .task {
            await viewModel.refreshIfNeeded()
        }
    }
}

#Preview {
    NavigationStack {
        ArticleDetailView(article: FeedResponse.preview.items[0].article)
    }
}
