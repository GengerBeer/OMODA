import SwiftUI

@MainActor
final class FeedViewModel: ObservableObject {
    @Published var items: [FeedItem] = []
    @Published var isLoading = false
    @Published var selectedTopics: [String] = []

    private let apiClient: APIClient
    private var nextCursor: String?
    private var hasLoaded = false
    private var reachedEnd = false

    let availableTopics = ["technology", "business", "science", "world", "culture", "sports"]

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func loadInitialFeed() async {
        guard hasLoaded == false else { return }
        hasLoaded = true
        if let profile = await apiClient.fetchProfile(userId: "demo-user") {
            selectedTopics = profile.selectedTopics
        }
        await loadMoreIfNeeded(currentItem: nil)
    }

    func loadMoreIfNeeded(currentItem: FeedItem?) async {
        guard isLoading == false else { return }
        guard reachedEnd == false else { return }
        if let currentItem, items.isEmpty == false {
            let thresholdIndex = max(items.count - 2, 0)
            guard items.firstIndex(of: currentItem) == thresholdIndex else { return }
        }

        isLoading = true
        defer { isLoading = false }

        let response = await apiClient.fetchFeed(userId: "demo-user", cursor: nextCursor)
        items.append(contentsOf: response.items.filter { candidate in
            items.contains(candidate) == false
        })
        nextCursor = response.nextCursor
        reachedEnd = response.nextCursor == nil
    }

    func toggleTopic(_ topic: String) async {
        guard isLoading == false else { return }

        var nextTopics = Set(selectedTopics)

        if nextTopics.contains(topic) {
            if nextTopics.count == 1 {
                return
            }
            nextTopics.remove(topic)
        } else {
            nextTopics.insert(topic)
        }

        let orderedTopics = availableTopics.filter { nextTopics.contains($0) }

        if let profile = await apiClient.updateTopics(userId: "demo-user", selectedTopics: orderedTopics) {
            selectedTopics = profile.selectedTopics
            nextCursor = nil
            reachedEnd = false
            items = []
            await loadMoreIfNeeded(currentItem: nil)
        }
    }
}

struct FeedView: View {
    @StateObject private var viewModel = FeedViewModel()

    var body: some View {
        GeometryReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(spacing: 18) {
                    ForEach(viewModel.items) { item in
                        NavigationLink {
                            ArticleDetailView(article: item.article)
                        } label: {
                            FeedCardView(item: item)
                                .frame(height: proxy.size.height - 96)
                        }
                        .buttonStyle(.plain)
                        .scrollTransition(.animated) { content, phase in
                            content
                                .scaleEffect(phase.isIdentity ? 1 : 0.94)
                                .opacity(phase.isIdentity ? 1 : 0.82)
                        }
                        .task {
                            await viewModel.loadMoreIfNeeded(currentItem: item)
                        }
                    }

                    if viewModel.isLoading {
                        ProgressView()
                            .tint(NewsTokTheme.Colors.primaryText)
                            .padding(.vertical, 40)
                    }
                }
                .scrollTargetLayout()
                .padding(.horizontal, NewsTokTheme.Spacing.screenPadding)
                .padding(.vertical, 6)
            }
            .scrollTargetBehavior(.paging)
            .background(NewsTokTheme.Colors.background.ignoresSafeArea())
            .navigationTitle("For You")
            .safeAreaInset(edge: .top) {
                TopicPicker(
                    topics: viewModel.availableTopics,
                    selectedTopics: viewModel.selectedTopics,
                    onTap: { topic in
                        Task {
                            await viewModel.toggleTopic(topic)
                        }
                    }
                )
            }
            .task {
                await viewModel.loadInitialFeed()
            }
        }
    }
}

private struct TopicPicker: View {
    let topics: [String]
    let selectedTopics: [String]
    let onTap: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(topics, id: \.self) { topic in
                    Button {
                        onTap(topic)
                    } label: {
                        Text(topic.capitalized)
                            .font(.system(.footnote, design: .rounded, weight: .semibold))
                            .foregroundStyle(selectedTopics.contains(topic) ? .white : NewsTokTheme.Colors.primaryText)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(
                                selectedTopics.contains(topic)
                                ? NewsTokTheme.Colors.accent
                                : Color.white.opacity(0.72),
                                in: Capsule()
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, NewsTokTheme.Spacing.screenPadding)
            .padding(.vertical, 10)
        }
        .background(.ultraThinMaterial)
    }
}

private struct FeedCardView: View {
    let item: FeedItem

    var body: some View {
        ZStack(alignment: .bottomLeading) {
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

            VStack(alignment: .leading, spacing: 14) {
                Text(item.article.summary.category.uppercased())
                    .font(.system(.caption, design: .rounded, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.75))

                Text(item.article.title)
                    .font(.system(.largeTitle, design: .rounded, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(3)

                Text(item.article.summary.summaryShort)
                    .font(.system(.body, design: .rounded, weight: .medium))
                    .foregroundStyle(.white.opacity(0.86))
                    .lineLimit(4)

                Text(item.reason)
                    .font(.system(.footnote, design: .rounded, weight: .medium))
                    .foregroundStyle(.white.opacity(0.68))
                    .padding(.top, 4)
            }
            .padding(28)
        }
        .frame(maxWidth: .infinity)
        .overlay(alignment: .topTrailing) {
            Text(item.article.source)
                .font(.system(.caption, design: .rounded, weight: .medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial, in: Capsule())
                .padding(18)
        }
        .shadow(color: .black.opacity(0.18), radius: 28, x: 0, y: 20)
        .overlay(alignment: .bottomTrailing) {
            Image(systemName: "arrow.up.forward")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white.opacity(0.85))
                .padding(26)
        }
    }
}

#Preview {
    NavigationStack {
        FeedView()
    }
}
